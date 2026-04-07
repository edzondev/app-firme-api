import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public/public.decorator';
import type { AuthUser } from 'src/common/types/auth-user';
import { DRIZZLE, type DrizzleDB } from 'src/db/drizzle.provider';
import { users } from 'src/db/schema';
import { FirebaseAdminProvider } from 'src/firebase/firebase.provider';

interface CachedUser {
  id: string | null;
  subscriptionStatus: string | null;
}

const USER_CACHE_TTL_MS = 60_000; // 60 seconds

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);
  private readonly userCache = new Map<
    string,
    { data: CachedUser; expiresAt: number }
  >();

  constructor(
    private readonly firebase: FirebaseAdminProvider,
    private readonly reflector: Reflector,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // WebSocket gateways handle their own auth in handleConnection()
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      const decodedToken = await this.firebase.verifyToken(token);
      const uid = decodedToken.uid;

      this.logger.debug(`Token verified for UID: ${uid}`);

      const dbUser = await this.getOrCacheUser(uid);

      const authUser: AuthUser = {
        userId: dbUser.id,
        firebaseUid: uid,
        email: decodedToken.email,
        name: decodedToken.name,
        picture: decodedToken.picture,
        emailVerified: decodedToken.email_verified,
        subscriptionStatus: dbUser.subscriptionStatus,
      };

      request.user = authUser;

      return true;
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private async getOrCacheUser(firebaseUid: string): Promise<CachedUser> {
    const now = Date.now();
    const cached = this.userCache.get(firebaseUid);

    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const [dbUser] = await this.db
      .select({
        id: users.id,
        subscriptionStatus: users.subscriptionStatus,
      })
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);

    const data: CachedUser = {
      id: dbUser?.id ?? null,
      subscriptionStatus: dbUser?.subscriptionStatus ?? null,
    };

    this.userCache.set(firebaseUid, {
      data,
      expiresAt: now + USER_CACHE_TTL_MS,
    });

    return data;
  }
}
