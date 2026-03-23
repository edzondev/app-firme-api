import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from 'src/db/drizzle.provider';
import { users } from 'src/db/schema';

@Injectable()
export class AuthService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) { }

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
    // Verificar si ya existe
    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, data.firebaseUid))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Crear nuevo usuario
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
   * Buscar usuario por Firebase UID
   */
  async getUserByFirebaseUid(firebaseUid: string) {
    console.log('Buscando usuario con Firebase UID:', firebaseUid);
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return result[0];
  }
}
