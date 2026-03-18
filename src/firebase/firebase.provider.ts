import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminProvider implements OnModuleInit {
  private app: admin.app.App;

  onModuleInit() {
    // Si ya está inicializado (hot reload), no reinicializar
    if (admin.apps.length > 0) {
      this.app = admin.apps[0]!;
      return;
    }

    // Opción A: Desde Base64 en variable de entorno
    const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (base64) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const serviceAccount = JSON.parse(
        Buffer.from(base64, 'base64').toString('utf-8'),
      );
      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      return;
    }

    // Opción B: Desde archivo JSON
    const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (filePath) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
      const serviceAccount = require(filePath);
      this.app = admin.initializeApp({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        credential: admin.credential.cert(serviceAccount),
      });
      return;
    }

    throw new Error(
      'Firebase: Set FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT_PATH',
    );
  }

  /**
   * Verifica un ID Token de Firebase.
   * Retorna la info del usuario si es válido.
   * Lanza error si es inválido o expirado.
   */
  async verifyToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return this.app.auth().verifyIdToken(idToken);
  }

  /**
   * Obtener info de un usuario por UID
   */
  async getUser(uid: string): Promise<admin.auth.UserRecord> {
    return this.app.auth().getUser(uid);
  }

  /**
   * Acceso al objeto auth() completo si necesitas más funciones
   */
  get auth() {
    return this.app.auth();
  }
}
