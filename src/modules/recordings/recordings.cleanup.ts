import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { R2_CLIENT } from './r2.client';
import { tripRecordings } from 'src/db/schema';
import { lte } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from 'src/db/drizzle.provider';

@Injectable()
export class RecordingsCleanupService {
  private readonly logger = new Logger(RecordingsCleanupService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(R2_CLIENT) private readonly r2Client: S3Client,
  ) {}

  @Cron('0 2 * * *')
  async handleCleanup() {
    const now = new Date();

    const expired = await this.db
      .select({
        id: tripRecordings.id,
        storageKey: tripRecordings.storageKey,
      })
      .from(tripRecordings)
      .where(lte(tripRecordings.expiresAt, now));

    if (expired.length === 0) {
      return;
    }

    this.logger.log(
      `[cleanup] Iniciando limpieza de ${expired.length} registros expirados`,
    );

    await Promise.all(
      expired.map((r) =>
        this.r2Client
          .send(
            new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: r.storageKey,
            }),
          )
          .catch((err) =>
            this.logger.error(
              `[cleanup] Error al borrar de R2 key=${r.storageKey}: ${err instanceof Error ? err.message : String(err)}`,
            ),
          ),
      ),
    );

    await this.db
      .delete(tripRecordings)
      .where(lte(tripRecordings.expiresAt, now));

    this.logger.log(
      `[cleanup] Limpieza completada — ${expired.length} registros eliminados`,
    );
  }
}
