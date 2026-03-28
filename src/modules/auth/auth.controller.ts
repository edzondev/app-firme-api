import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from 'src/common/decorators/current-user/current-user.decorator';
import { Public } from 'src/common/decorators/public/public.decorator';
import type { AuthUser } from 'src/common/types/auth-user';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @CurrentUser() user: AuthUser,
    @Body() body: { fullName: string; phone?: string },
  ) {
    return this.authService.createOrGetUser({
      firebaseUid: user.firebaseUid,
      email: user.email,
      fullName: body.fullName || user.name || '',
      phone: body.phone,
    });
  }

  @Get('me')
  async getProfile(@CurrentUser('userId') userId: string) {
    return this.authService.getUserById(userId);
  }

  @Public()
  @Get('/health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
