import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { LocationBuffer } from './location/location.buffer';
import { SosModule } from '../sos/sos.module';

@Module({
  imports: [SosModule],
  providers: [TrackingGateway, LocationBuffer],
  exports: [TrackingGateway, LocationBuffer],
})
export class TrackingModule {}
