import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { LocationBuffer } from './location/location.buffer';

@Module({
  providers: [TrackingGateway, LocationBuffer],
  exports: [TrackingGateway, LocationBuffer],
})
export class TrackingModule {}
