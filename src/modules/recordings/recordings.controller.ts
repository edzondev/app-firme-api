import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { RecordingsService } from './recordings.service';
import { CurrentUser } from 'src/common/decorators/current-user/current-user.decorator';
import type { AuthUser } from 'src/common/types/auth-user';

@Controller('recordings')
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  @Post('presigned-upload')
  getUploadUrl(@Body() body: { tripId: string; chunkNumber: number }) {
    return this.recordingsService.getPresignedUploadUrl(
      body.tripId,
      body.chunkNumber,
    );
  }

  @Post('confirm')
  confirmUpload(
    @Body()
    body: {
      tripId: string;
      key: string;
      chunkNumber: number;
      durationSeconds: number;
      fileSizeBytes: number;
      encryptionKeyHash: string;
    },
  ) {
    return this.recordingsService.confirmUpload(body);
  }

  @Get(':id/download-url')
  getDownloadUrl(@Param('id') id: string, @CurrentUser() user: any) {
    return this.recordingsService.getPresignedDownloadUrl(id, user.id);
  }

  @Delete(':tripId/recordings')
  async deleteRecordings(
    @Param('tripId') tripId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recordingsService.deleteRecordingsByTripId(tripId, user.userId!);
  }

  // recordings.controller.ts
  @Get(':tripId/recordings')
  async getRecordings(
    @Param('tripId') tripId: string,
    @CurrentUser() user: any,
  ) {
    return this.recordingsService.getRecordingsWithDownloadUrls(
      tripId,
      user.id,
    );
  }
}
