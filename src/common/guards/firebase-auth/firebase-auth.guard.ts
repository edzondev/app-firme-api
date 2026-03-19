/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public/public.decorator';
import { FirebaseAdminProvider } from 'src/firebase/firebase.provider';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebase: FirebaseAdminProvider,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Si el endpoint está marcado como @Public(), dejarlo pasar
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const authHeader = request.headers.authorization;

    // Verificar que existe el header
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    // Extraer el token (quitar "Bearer ")
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const token = authHeader.split('Bearer ')[1];
    console.log('[DEV] Firebase JWT token:', token);

    try {
      // Verificar el token con Firebase Admin
      const decodedToken = await this.firebase.verifyToken(token);

      // Adjuntar la info del usuario al request
      // Ahora cualquier controller puede acceder a request.user
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      request.user = {
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
        picture: decodedToken.picture,
        emailVerified: decodedToken.email_verified,
      };

      return true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
