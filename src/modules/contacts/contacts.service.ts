import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from 'src/db/drizzle.provider';
import { emergencyContacts, users } from 'src/db/schema';

type ContactSelect = typeof emergencyContacts.$inferSelect;
type ContactInsert = typeof emergencyContacts.$inferInsert;

const FREE_CONTACT_LIMIT = 3;
const PREMIUM_CONTACT_LIMIT = 5;

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  // ---- helpers ----

  private async findContactOrFail(
    contactId: string,
    userId: string,
  ): Promise<ContactSelect> {
    const result = await this.db
      .select()
      .from(emergencyContacts)
      .where(
        and(
          eq(emergencyContacts.id, contactId),
          eq(emergencyContacts.userId, userId),
        ),
      )
      .limit(1);

    if (!result[0]) throw new NotFoundException('Contacto no encontrado.');
    return result[0];
  }

  async autoLinkUser(phone: string): Promise<string | null> {
    const result = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    return result[0]?.id ?? null;
  }

  // ---- public methods ----

  async getContacts(userId: string): Promise<ContactSelect[]> {
    return this.db
      .select()
      .from(emergencyContacts)
      .where(eq(emergencyContacts.userId, userId))
      .orderBy(asc(emergencyContacts.priority));
  }

  async createContact(
    userId: string,
    subscriptionStatus: string | null,
    data: {
      name: string;
      phone: string;
      relationship?: ContactInsert['relationship'];
      notifyMethod?: ContactInsert['notifyMethod'];
      notifyOnTripStart?: boolean;
    },
  ): Promise<ContactSelect> {
    const isPremium = subscriptionStatus === 'active';
    const limit = isPremium ? PREMIUM_CONTACT_LIMIT : FREE_CONTACT_LIMIT;

    const existing = await this.db
      .select({ id: emergencyContacts.id })
      .from(emergencyContacts)
      .where(eq(emergencyContacts.userId, userId));

    if (existing.length >= limit) {
      throw new BadRequestException(
        `Límite de contactos alcanzado (${limit} máximo para tu plan).`,
      );
    }

    const linkedUserId = await this.autoLinkUser(data.phone);

    const [contact] = await this.db
      .insert(emergencyContacts)
      .values({
        userId,
        name: data.name,
        phone: data.phone,
        relationship: data.relationship ?? 'otro',
        notifyMethod: data.notifyMethod ?? 'push',
        notifyOnTripStart: data.notifyOnTripStart ?? false,
        priority: existing.length,
        linkedUserId: linkedUserId ?? undefined,
      })
      .returning();

    this.logger.debug(
      `Contacto creado para userId=${userId}${linkedUserId ? ` (vinculado a userId=${linkedUserId})` : ''}`,
    );

    return contact;
  }

  async updateContact(
    contactId: string,
    userId: string,
    data: Partial<
      Pick<
        ContactSelect,
        'name' | 'phone' | 'relationship' | 'priority' | 'notifyMethod' | 'notifyOnTripStart'
      >
    >,
  ): Promise<ContactSelect> {
    await this.findContactOrFail(contactId, userId);

    let linkedUserId: string | null | undefined;
    if (data.phone !== undefined) {
      linkedUserId = await this.autoLinkUser(data.phone);
    }

    const [updated] = await this.db
      .update(emergencyContacts)
      .set({
        ...data,
        ...(linkedUserId !== undefined ? { linkedUserId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(emergencyContacts.id, contactId))
      .returning();

    return updated;
  }

  async deleteContact(contactId: string, userId: string): Promise<void> {
    await this.findContactOrFail(contactId, userId);

    await this.db
      .delete(emergencyContacts)
      .where(eq(emergencyContacts.id, contactId));
  }

  async countContacts(
    userId: string,
    subscriptionStatus: string | null,
  ): Promise<{ count: number; limit: number; isPremium: boolean }> {
    const isPremium = subscriptionStatus === 'active';

    const result = await this.db
      .select({ id: emergencyContacts.id })
      .from(emergencyContacts)
      .where(eq(emergencyContacts.userId, userId));

    return {
      count: result.length,
      limit: isPremium ? PREMIUM_CONTACT_LIMIT : FREE_CONTACT_LIMIT,
      isPremium,
    };
  }

  async reorderContacts(
    userId: string,
    order: { contactId: string; priority: number }[],
  ): Promise<void> {
    if (!order.length) return;

    const contactIds = order.map((o) => o.contactId);

    const existing = await this.db
      .select({ id: emergencyContacts.id })
      .from(emergencyContacts)
      .where(
        and(
          eq(emergencyContacts.userId, userId),
          inArray(emergencyContacts.id, contactIds),
        ),
      );

    if (existing.length !== order.length) {
      throw new ForbiddenException(
        'Uno o más contactos no pertenecen a este usuario.',
      );
    }

    await this.db.transaction(async (tx) => {
      for (const { contactId, priority } of order) {
        await tx
          .update(emergencyContacts)
          .set({ priority, updatedAt: new Date() })
          .where(eq(emergencyContacts.id, contactId));
      }
    });
  }

  /**
   * Retorna los contactos que recibirán la ubicación durante un viaje.
   * Free = 3 contactos (prioridad 0, 1, 2). Premium = 5 contactos.
   * Usado por TripService y SosService.
   */
  async getShareableContacts(
    userId: string,
    subscriptionStatus: string | null,
  ): Promise<ContactSelect[]> {
    const isPremium = subscriptionStatus === 'active';
    const limit = isPremium ? PREMIUM_CONTACT_LIMIT : FREE_CONTACT_LIMIT;

    return this.db
      .select()
      .from(emergencyContacts)
      .where(eq(emergencyContacts.userId, userId))
      .orderBy(asc(emergencyContacts.priority))
      .limit(limit);
  }
}
