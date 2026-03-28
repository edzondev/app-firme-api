import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SosService } from './sos.service';
import { CurrentUser } from 'src/common/decorators/current-user/current-user.decorator';

type Props = {
  dto: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    tripId?: string;
  };
};

@Controller('sos')
export class SosController {
  constructor(private readonly sosService: SosService) {}

  @Post()
  async triggerSOS(
    @CurrentUser('userId') userId: string,
    @CurrentUser('subscriptionStatus') subscriptionStatus: string | null,
    @Body() dto: Props['dto'],
  ) {
    return this.sosService.triggerSOS(userId, subscriptionStatus, dto);
  }

  @Patch(':sosId/resolve')
  async resolveSOS(
    @CurrentUser('userId') userId: string,
    @Param('sosId') sosId: string,
    @Body() dto: { status: 'resolved' | 'false_alarm'; note?: string },
  ) {
    return this.sosService.resolveSOS(sosId, userId, dto);
  }

  @Get('active')
  async getActiveSOS(@CurrentUser('userId') userId: string) {
    const sos = await this.sosService.getActiveSOS(userId);
    return sos || { active: false };
  }

  @Get(':sosId')
  async getSOSDetail(
    @CurrentUser('userId') userId: string,
    @Param('sosId') sosId: string,
  ) {
    return this.sosService.getSOSDetail(sosId, userId);
  }
}
