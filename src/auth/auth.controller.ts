import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from 'src/common/decorators/current-user/current-user.decorator';
import { Public } from 'src/common/decorators/public/public.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * POST /api/auth/register
   * Se llama DESPUÉS de que el usuario se registra en Firebase.
   * Crea la fila en tu tabla "users".
   */
  @Post('register')
  async register(
    @CurrentUser() user: { firebaseUid: string; email: string; name: string },
    @Body() body: { fullName: string; phone?: string },
  ) {
    return this.authService.createOrGetUser({
      firebaseUid: user.firebaseUid,
      email: user.email,
      fullName: body.fullName || user.name,
      phone: body.phone,
    });
  }

  /**
   * GET /api/auth/me
   * Retorna el perfil del usuario actual.
   */
  @Get('me')
  async getProfile(
    @CurrentUser('firebaseUid') firebaseUid: string,
  ) {
    return this.authService.getUserByFirebaseUid(firebaseUid);
  }

  /**
   * GET /api/health
   * Endpoint público (no requiere auth).
   */
  @Public()
  @Get('/health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
