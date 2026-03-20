import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SosService } from './sos.service';
import { CurrentUser } from 'src/common/decorators/current-user/current-user.decorator';
import { sosAlerts } from 'src/db/schema';

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
    @CurrentUser('firebaseUid') firebaseUid: string,
    @Body()
    dto: Props['dto'],
  ) {
    return this.sosService.triggerSOS(firebaseUid, dto as Props['dto']);
  }

  @Patch(':sosId/resolve')
  async resolveSOS(
    @CurrentUser('firebaseUid') firebaseUid: string,
    @Param('sosId') sosId: string,
    @Body() dto: { status: 'resolved' | 'false_alarm'; note?: string },
  ) {
    return this.sosService.resolveSOS(sosId, firebaseUid, dto);
  }

  @Get('active')
  async getActiveSOS(@CurrentUser('firebaseUid') firebaseUid: string) {
    const sos = await this.sosService.getActiveSOS(firebaseUid);
    return sos || { active: false };
  }

  /**
   * GET /api/v1/sos/:sosId
   * Detalle de un SOS con todas sus notificaciones.
   */
  @Get(':sosId')
  async getSOSDetail(
    @CurrentUser('firebaseUid') firebaseUid: string,
    @Param('sosId') sosId: string,
  ) {
    return this.sosService.getSOSDetail(sosId, firebaseUid);
  }
}
