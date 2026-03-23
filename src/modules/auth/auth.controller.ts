import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from 'src/common/decorators/current-user/current-user.decorator';
import { Public } from 'src/common/decorators/public/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

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

  @Get('me')
  async getProfile(@CurrentUser('firebaseUid') firebaseUid: string) {
    return this.authService.getUserByFirebaseUid(firebaseUid);
  }

  @Public()
  @Get('/health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
