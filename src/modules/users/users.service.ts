import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from 'src/db/drizzle.provider';
import { users } from 'src/db/schema';

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
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) { }

  async updateProfile(firebaseUid: string, data: UpdateProfileInput) {
    const [user] = await this.db
      .update(users)
      .set({
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(users.firebaseUid, firebaseUid), eq(users.isDeleted, false)))
      .returning();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async updateSettings(firebaseUid: string, data: UpdateSettingsInput) {
    const [user] = await this.db
      .update(users)
      .set({
        ...(data.darkMode !== undefined
          ? { settingsDarkMode: data.darkMode }
          : {}),
        ...(data.audioQuality !== undefined
          ? { settingsAudioQuality: data.audioQuality }
          : {}),
        ...(data.sosDelay !== undefined ? { settingsSosDelay: data.sosDelay } : {}),
        ...(data.notificationsEnabled !== undefined
          ? { settingsNotificationsEnabled: data.notificationsEnabled }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(users.firebaseUid, firebaseUid), eq(users.isDeleted, false)))
      .returning();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async updatePushToken(firebaseUid: string, token: string): Promise<void> {
    const [user] = await this.db
      .update(users)
      .set({
        expoPushToken: token,
        updatedAt: new Date(),
      })
      .where(and(eq(users.firebaseUid, firebaseUid), eq(users.isDeleted, false)))
      .returning({ id: users.id });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }

  async updateSosMessage(firebaseUid: string, message: string): Promise<void> {
    const [user] = await this.db
      .update(users)
      .set({
        customSosMessage: message,
        updatedAt: new Date(),
      })
      .where(and(eq(users.firebaseUid, firebaseUid), eq(users.isDeleted, false)))
      .returning({ id: users.id });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }

  async softDelete(firebaseUid: string): Promise<void> {
    const [user] = await this.db
      .update(users)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(and(eq(users.firebaseUid, firebaseUid), eq(users.isDeleted, false)))
      .returning({ id: users.id });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }

  async getSubscriptionStatus(firebaseUid: string): Promise<{
    isPremium: boolean;
    expiresAt: Date | null;
    store: string | null;
  }> {
    const [user] = await this.db
      .select({
        subscriptionStatus: users.subscriptionStatus,
        subscriptionExpiresAt: users.subscriptionExpiresAt,
        subscriptionStore: users.subscriptionStore,
      })
      .from(users)
      .where(and(eq(users.firebaseUid, firebaseUid), eq(users.isDeleted, false)))
      .limit(1);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      isPremium: user.subscriptionStatus === 'active',
      expiresAt: user.subscriptionExpiresAt ?? null,
      store: user.subscriptionStore ?? null,
    };
  }
}
