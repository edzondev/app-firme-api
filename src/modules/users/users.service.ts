import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.provider';
import { emergencyContacts, users } from '../../db/schema';

type UpdateProfileInput = {
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
};

type UpdateSettingsInput = {
  darkMode?: boolean;
  audioQuality?: string;
  sosDelay?: number;
  notificationsEnabled?: boolean;
};

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const [user] = await this.db
      .update(users)
      .set({
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), eq(users.isDeleted, false)))
      .returning();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async updateSettings(userId: string, data: UpdateSettingsInput) {
    const [user] = await this.db
      .update(users)
      .set({
        ...(data.darkMode !== undefined
          ? { settingsDarkMode: data.darkMode }
          : {}),
        ...(data.audioQuality !== undefined
          ? { settingsAudioQuality: data.audioQuality }
          : {}),
        ...(data.sosDelay !== undefined
          ? { settingsSosDelay: data.sosDelay }
          : {}),
        ...(data.notificationsEnabled !== undefined
          ? { settingsNotificationsEnabled: data.notificationsEnabled }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), eq(users.isDeleted, false)))
      .returning();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async updatePushToken(userId: string, token: string): Promise<void> {
    const [user] = await this.db
      .update(users)
      .set({
        expoPushToken: token,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), eq(users.isDeleted, false)))
      .returning({ id: users.id });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Sync token to all emergency_contacts rows where this user is linked,
    // so SosService can read it directly from contact.contactPushToken
    await this.db
      .update(emergencyContacts)
      .set({ contactPushToken: token, updatedAt: new Date() })
      .where(eq(emergencyContacts.linkedUserId, userId));
  }

  async updateSosMessage(userId: string, message: string): Promise<void> {
    const [user] = await this.db
      .update(users)
      .set({
        customSosMessage: message,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), eq(users.isDeleted, false)))
      .returning({ id: users.id });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }

  async softDelete(userId: string): Promise<void> {
    const [user] = await this.db
      .update(users)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), eq(users.isDeleted, false)))
      .returning({ id: users.id });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }

  getSubscriptionStatus(subscriptionStatus: string | null): {
    isPremium: boolean;
    status: string;
  } {
    return {
      isPremium: subscriptionStatus === 'active',
      status: subscriptionStatus ?? 'free',
    };
  }
}
