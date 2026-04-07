import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { R2_CLIENT } from './r2.client';
import { tripRecordings, trips, users } from 'src/db/schema';
import { and, eq, lte } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from 'src/db/drizzle.provider';
@Injectable()
export class RecordingsService {
  private readonly logger = new Logger(RecordingsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(R2_CLIENT) private readonly r2Client: S3Client,
  ) {}

  // 1. Generar presigned URL para que el mobile suba directamente a R2
  async getPresignedUploadUrl(tripId: string, chunkNumber: number) {
    const key = `trips/${tripId}/chunk-${chunkNumber}.enc`;

    this.logger.log(
      `[presigned-upload] Generando URL para tripId=${tripId} chunk=${chunkNumber} key=${key} bucket=${process.env.R2_BUCKET_NAME}`,
    );

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: 'application/octet-stream', // binario encriptado
    });

    try {
      const uploadUrl = await getSignedUrl(this.r2Client, command, {
        expiresIn: 900, // 15 minutos para subir
      });

      this.logger.log(
        `[presigned-upload] URL generada exitosamente para key=${key} — expira en 900s`,
      );

      return { uploadUrl, key };
    } catch (err) {
      this.logger.error(
        `[presigned-upload] Error al generar presigned URL para key=${key}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }
  }

  // 2. Confirmar que el upload fue exitoso y guardar en DB
  async confirmUpload(dto: {
    tripId: string;
    key: string;
    chunkNumber: number;
    durationSeconds: number;
    fileSizeBytes: number;
    encryptionKeyHash: string;
  }) {
    this.logger.log(
      `[confirm-upload] Confirmando subida — tripId=${dto.tripId} chunk=${dto.chunkNumber} key=${dto.key} size=${dto.fileSizeBytes}B duration=${dto.durationSeconds}s`,
    );

    const [trip] = await this.db
      .select({ userId: trips.userId })
      .from(trips)
      .where(eq(trips.id, dto.tripId))
      .limit(1);

    let retentionDays = 30;

    if (trip) {
      const [user] = await this.db
        .select({ subscriptionStatus: users.subscriptionStatus })
        .from(users)
        .where(eq(users.id, trip.userId))
        .limit(1);

      if (user?.subscriptionStatus === 'active') {
        retentionDays = 90;
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);

    try {
      const [recording] = await this.db
        .insert(tripRecordings)
        .values({
          tripId: dto.tripId,
          storageProvider: 'r2',
          storageKey: dto.key,
          chunkNumber: dto.chunkNumber,
          durationSeconds: dto.durationSeconds,
          fileSizeBytes: dto.fileSizeBytes,
          encryptionAlgorithm: 'AES-256-GCM',
          encryptionKeyHash: dto.encryptionKeyHash,
          expiresAt,
        })
        .returning({ id: tripRecordings.id });

      this.logger.log(
        `[confirm-upload] Chunk registrado en DB — recordingId=${recording.id} tripId=${dto.tripId} chunk=${dto.chunkNumber}`,
      );

      return recording;
    } catch (err) {
      this.logger.error(
        `[confirm-upload] Error al guardar en DB — tripId=${dto.tripId} chunk=${dto.chunkNumber} key=${dto.key}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }
  }

  // 3. Generar presigned URL para descargar (reproducir en el mobile)
  async getPresignedDownloadUrl(recordingId: string, userId: string) {
    const [recording] = await this.db
      .select()
      .from(tripRecordings)
      .where(eq(tripRecordings.id, recordingId))
      .limit(1);

    if (!recording) throw new Error('Recording not found');

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: recording.storageKey,
    });

    const downloadUrl = await getSignedUrl(this.r2Client, command, {
      expiresIn: 3600, // 1 hora para descargar/reproducir
    });

    return { downloadUrl };
  }

  // 4. Eliminar archivo de R2 (cuando expira o usuario lo borra)
  async deleteRecording(recordingId: string) {
    const [recording] = await this.db
      .select({ key: tripRecordings.storageKey })
      .from(tripRecordings)
      .where(eq(tripRecordings.id, recordingId))
      .limit(1);

    if (!recording) return;

    await this.r2Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: recording.key,
      }),
    );

    await this.db
      .delete(tripRecordings)
      .where(eq(tripRecordings.id, recordingId));
  }

  async deleteRecordingsByTripId(tripId: string, userId: string) {
    const [trip] = await this.db
      .select()
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
      .limit(1);

    if (!trip) {
      throw new NotFoundException('Viaje no encontrado.');
    }

    const recordings = await this.db
      .select({ storageKey: tripRecordings.storageKey })
      .from(tripRecordings)
      .where(eq(tripRecordings.tripId, tripId));

    if (recordings.length === 0) {
      return { ok: true };
    }

    this.logger.log(
      `[delete-by-trip] Eliminando ${recordings.length} chunks de R2 — tripId=${tripId}`,
    );

    await Promise.all(
      recordings.map((r) =>
        this.r2Client.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: r.storageKey,
          }),
        ),
      ),
    );

    await this.db
      .delete(tripRecordings)
      .where(eq(tripRecordings.tripId, tripId));

    this.logger.log(
      `[delete-by-trip] Limpieza completada — tripId=${tripId} chunks=${recordings.length}`,
    );

    return { ok: true };
  }

  // recordings.service.ts
  async getRecordingsWithDownloadUrls(tripId: string, userId: string) {
    const recordings = await this.db
      .select()
      .from(tripRecordings)
      .where(eq(tripRecordings.tripId, tripId))
      .orderBy(tripRecordings.chunkNumber);

    return Promise.all(
      recordings.map(async (r) => {
        const command = new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: r.storageKey,
          ResponseContentType: 'audio/mp4',
        });
        const downloadUrl = await getSignedUrl(this.r2Client, command, {
          expiresIn: 3600,
        });
        return { ...r, downloadUrl };
      }),
    );
  }
}
