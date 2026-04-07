import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RecordingsService } from './recordings.service';
import { RecordingsController } from './recordings.controller';
import { RecordingsCleanupService } from './recordings.cleanup';
import { r2ClientProvider } from './r2.client';

@Module({
  imports: [ConfigModule],
  controllers: [RecordingsController],
  providers: [RecordingsService, RecordingsCleanupService, r2ClientProvider],
  exports: [RecordingsService],
})
export class RecordingsModule {}
