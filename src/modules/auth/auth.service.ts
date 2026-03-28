import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from 'src/db/drizzle.provider';
import { users } from 'src/db/schema';

@Injectable()
export class AuthService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  /**
   * Crea un usuario nuevo o retorna el existente.
   * Se llama después del registro en Firebase.
   */
  async createOrGetUser(data: {
    firebaseUid: string;
    email?: string;
    fullName: string;
    phone?: string;
  }) {
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, data.firebaseUid))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const [newUser] = await this.db
      .insert(users)
      .values({
        firebaseUid: data.firebaseUid,
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
      })
      .returning();

    return newUser;
  }

  /**
   * Buscar usuario por su UUID interno (PK).
   */
  async getUserById(userId: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return result[0];
  }
}
