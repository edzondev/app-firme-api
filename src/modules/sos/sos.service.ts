import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from 'src/db/drizzle.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { ContactsService } from '../contacts/contacts.service';
import {
  emergencyContacts,
  sosAlerts,
  sosNotifications,
  trips,
  users,
} from 'src/db/schema';
import { and, desc, eq } from 'drizzle-orm';

@Injectable()
export class SosService {
  private readonly logger = new Logger(SosService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly notifications: NotificationsService,
    private readonly contacts: ContactsService,
  ) {}

  async triggerSOS(
    userId: string,
    dto: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      tripId?: string;
    },
  ) {
    this.logger.warn(
      `SOS TRIGGERED by user ${userId} at ${dto.latitude},${dto.longitude}`,
    );

    // 1. Verificar que no tenga un SOS activo
    const activeSOS = await this.getActiveSOS(userId);
    if (activeSOS) {
      throw new BadRequestException(
        'Ya tienes un SOS activo. Resuélvelo antes de activar otro.',
      );
    }

    // 2. Si viene con tripId, actualizar el trip a 'sos_triggered'
    if (dto.tripId) {
      await this.db
        .update(trips)
        .set({ status: 'sos_triggered' })
        .where(and(eq(trips.id, dto.tripId), eq(trips.userId, userId)));
    }

    // 3. Crear registro en sos_alerts
    const [alert] = await this.db
      .insert(sosAlerts)
      .values({
        userId,
        tripId: dto.tripId || null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy || null,
        status: 'active',
      })
      .returning();

    // 4. Obtener info del usuario (nombre + isPremium + mensaje custom)
    const [user] = await this.db
      .select({
        fullName: users.fullName,
        subscriptionStatus: users.subscriptionStatus,
        customSosMessage: users.customSosMessage,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isPremium = user?.subscriptionStatus === 'active';

    // 5. Construir el mensaje SOS
    const mapsLink = `https://maps.google.com/?q=${dto.latitude},${dto.longitude}`;
    const timestamp = new Date().toLocaleString('es-PE', {
      timeZone: 'America/Lima',
    });

    const message =
      isPremium && user?.customSosMessage
        ? user.customSosMessage
            .replace('{nombre}', user.fullName || 'Usuario')
            .replace('{ubicacion}', mapsLink)
            .replace('{hora}', timestamp)
        : `🚨 ALERTA DE EMERGENCIA: ${user?.fullName || 'Un usuario'} ha activado SOS en Firme. Ubicación: ${mapsLink} — Hora: ${timestamp}`;

    // 6. Obtener contactos y notificar (respeta límite free/premium)
    const userContacts = await this.contacts.getShareableContacts(userId);

    // Notificar a cada contacto en paralelo
    const notificationResults = await Promise.allSettled(
      userContacts.map(async (contact) => {
        // a. Enviar push (siempre, free y premium)
        const pushResult = contact.contactPushToken
          ? await this.notifications.sendPush({
              pushToken: contact.contactPushToken,
              title: '🚨 SOS — Alerta de emergencia',
              body: `${user?.fullName || 'Un contacto'} necesita ayuda`,
              data: {
                type: 'sos',
                sosAlertId: alert.id,
                tripId: dto.tripId || null,
                latitude: dto.latitude,
                longitude: dto.longitude,
              },
            })
          : { success: false, error: 'Sin push token' };

        // Registrar notificación push en DB
        await this.db.insert(sosNotifications).values({
          sosAlertId: alert.id,
          contactId: contact.id,
          channel: 'push',
          deliveredAt: pushResult.success ? new Date() : null,
          failedAt: !pushResult.success ? new Date() : null,
          failureReason: !pushResult.success ? (pushResult as any).error : null,
          providerMessageId: (pushResult as any).ticketId || null,
        });

        // b. SMS (solo premium)
        if (isPremium && contact.phone) {
          const smsResult = await this.notifications.sendSMS({
            to: contact.phone,
            message,
          });

          await this.db.insert(sosNotifications).values({
            sosAlertId: alert.id,
            contactId: contact.id,
            channel: 'sms',
            deliveredAt: smsResult.success ? new Date() : null,
            failedAt: !smsResult.success ? new Date() : null,
            failureReason: !smsResult.success ? (smsResult as any).error : null,
            providerMessageId: (smsResult as any).messageId || null,
          });
        }

        // c. WhatsApp (solo premium)
        if (isPremium && contact.phone) {
          const waResult = await this.notifications.sendWhatsApp({
            to: contact.phone,
            message,
          });

          await this.db.insert(sosNotifications).values({
            sosAlertId: alert.id,
            contactId: contact.id,
            channel: 'whatsapp',
            deliveredAt: waResult.success ? new Date() : null,
            failedAt: !waResult.success ? new Date() : null,
            failureReason: !waResult.success ? (waResult as any).error : null,
            providerMessageId: (waResult as any).messageId || null,
          });
        }

        return {
          contactId: contact.id,
          contactName: contact.name,
          push: pushResult.success,
          sms: isPremium,
          whatsapp: isPremium,
        };
      }),
    );

    // 7. Resumir resultados
    const notified = notificationResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    this.logger.log(
      `SOS ${alert.id}: notified ${notified.length}/${userContacts.length} contacts`,
    );

    return {
      sosAlertId: alert.id,
      status: 'active',
      latitude: dto.latitude,
      longitude: dto.longitude,
      contactsNotified: notified,
      message,
    };
  }

  async resolveSOS(
    sosId: string,
    userId: string,
    dto: { status: 'resolved' | 'false_alarm'; note?: string },
  ) {
    const alert = await this.findAlertOrFail(sosId, userId);

    if (alert.status !== 'active') {
      throw new BadRequestException('Este SOS ya fue resuelto.');
    }

    const [updated] = await this.db
      .update(sosAlerts)
      .set({
        status: dto.status as any,
        resolvedAt: new Date(),
        resolutionNote: dto.note || null,
      })
      .where(eq(sosAlerts.id, sosId))
      .returning();

    // Si el SOS estaba vinculado a un trip, restaurar el trip a 'active'
    if (updated.tripId) {
      const [trip] = await this.db
        .select({ status: trips.status })
        .from(trips)
        .where(eq(trips.id, updated.tripId))
        .limit(1);

      if (trip?.status === 'sos_triggered') {
        await this.db
          .update(trips)
          .set({ status: 'active' })
          .where(eq(trips.id, updated.tripId));
      }
    }

    return updated;
  }

  async getActiveSOS(userId: string) {
    const result = await this.db
      .select()
      .from(sosAlerts)
      .where(and(eq(sosAlerts.userId, userId), eq(sosAlerts.status, 'active')))
      .limit(1);

    return result[0] || null;
  }

  async getSOSDetail(sosId: string, userId: string) {
    const alert = await this.findAlertOrFail(sosId, userId);

    // Obtener todas las notificaciones enviadas
    const notifications = await this.db
      .select({
        id: sosNotifications.id,
        channel: sosNotifications.channel,
        sentAt: sosNotifications.sentAt,
        deliveredAt: sosNotifications.deliveredAt,
        failedAt: sosNotifications.failedAt,
        failureReason: sosNotifications.failureReason,
        contactName: emergencyContacts.name,
        contactPhone: emergencyContacts.phone,
      })
      .from(sosNotifications)
      .innerJoin(
        emergencyContacts,
        eq(sosNotifications.contactId, emergencyContacts.id),
      )
      .where(eq(sosNotifications.sosAlertId, sosId))
      .orderBy(sosNotifications.sentAt);

    return {
      ...alert,
      notifications,
    };
  }

  async getSOSHistory(userId: string, limit = 20) {
    return this.db
      .select()
      .from(sosAlerts)
      .where(eq(sosAlerts.userId, userId))
      .orderBy(desc(sosAlerts.triggeredAt))
      .limit(limit);
  }

  private async findAlertOrFail(sosId: string, userId: string) {
    const result = await this.db
      .select()
      .from(sosAlerts)
      .where(and(eq(sosAlerts.id, sosId), eq(sosAlerts.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('Alerta SOS no encontrada.');
    }

    return result[0];
  }
}
