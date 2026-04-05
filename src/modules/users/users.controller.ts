import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from 'src/common/decorators/current-user/current-user.decorator';

@Controller('/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('/me')
  updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() data: { fullName?: string; phone?: string; avatarUrl?: string },
  ) {
    return this.usersService.updateProfile(userId, data);
  }

  @Patch('/me/settings')
  updateSettings(
    @CurrentUser('userId') userId: string,
    @Body()
    data: {
      darkMode?: boolean;
      audioQuality?: string;
      sosDelay?: number;
      notificationsEnabled?: boolean;
    },
  ) {
    return this.usersService.updateSettings(userId, data);
  }

  @Patch('/me/push-token')
  updatePushToken(
    @CurrentUser('userId') userId: string,
    @Body() body: { token: string },
  ) {
    return this.usersService.updatePushToken(userId, body.token);
  }

  @Patch('/me/sos-message')
  updateSosMessage(
    @CurrentUser('userId') userId: string,
    @Body() body: { message: string },
  ) {
    return this.usersService.updateSosMessage(userId, body.message);
  }

  @Delete('/me')
  softDelete(@CurrentUser('userId') userId: string) {
    return this.usersService.softDelete(userId);
  }

  @Get('/me/subscription')
  getSubscriptionStatus(
    @CurrentUser('subscriptionStatus') subscriptionStatus: string | null,
  ) {
    return this.usersService.getSubscriptionStatus(subscriptionStatus);
  }
}
