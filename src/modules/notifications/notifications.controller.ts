import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly usersService: UsersService) {}

  @Post('token')
  async saveToken(
    @CurrentUser('userId') userId: string,
    @Body() body: { token: string },
  ): Promise<{ ok: boolean }> {
    await this.usersService.updatePushToken(userId, body.token);
    return { ok: true };
  }
}
