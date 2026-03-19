// src/modules/tracking/location.buffer.ts

import { Inject, Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { locationLogs, trips } from 'src/db/schema';
import { DRIZZLE, type DrizzleDB } from 'src/db/drizzle.provider';

interface BufferedPoint {
  tripId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  deviceTimestamp: Date;
}

@Injectable()
export class LocationBuffer implements OnModuleDestroy {
  private readonly logger = new Logger(LocationBuffer.name);

  // El buffer: un Map donde la key es el tripId
  // y el valor es un array de puntos GPS acumulados
  private buffer = new Map<string, BufferedPoint[]>();

  // El timer que se ejecuta cada 30 segundos
  private flushTimer: NodeJS.Timeout;

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {
    // Iniciar el timer de flush automático
    this.flushTimer = setInterval(() => {
      this.flushAll().catch((err) =>
        this.logger.error('Error in auto-flush', err),
      );
    }, 30_000); // 30 segundos

    this.logger.log('LocationBuffer initialized, flushing every 30s');
  }

  /**
   * Agregar un punto GPS al buffer.
   * NO escribe a la base de datos.
   * Es instantáneo (< 1ms).
   */
  add(point: BufferedPoint): void {
    const existing = this.buffer.get(point.tripId) || [];
    existing.push(point);
    this.buffer.set(point.tripId, existing);
  }

  /**
   * Flush de TODOS los trips acumulados a la base de datos.
   * Se ejecuta automáticamente cada 30 segundos.
   */
  async flushAll(): Promise<void> {
    if (this.buffer.size === 0) return;

    const batchId = `batch-${Date.now()}`;
    const allPoints: BufferedPoint[] = [];
    const tripCounts = new Map<string, number>();

    // Recolectar todos los puntos y contar por trip
    for (const [tripId, points] of this.buffer) {
      allPoints.push(...points);
      tripCounts.set(tripId, points.length);
    }

    if (allPoints.length === 0) return;

    this.logger.debug(
      `Flushing ${allPoints.length} points for ${tripCounts.size} trips`,
    );

    try {
      // Un solo INSERT con todos los puntos
      await this.db.insert(locationLogs).values(
        allPoints.map((p) => ({
          tripId: p.tripId,
          latitude: p.latitude,
          longitude: p.longitude,
          accuracy: p.accuracy,
          speed: p.speed,
          heading: p.heading,
          altitude: p.altitude,
          deviceTimestamp: p.deviceTimestamp,
          batchId,
        })),
      );

      // Actualizar el conteo de puntos por trip
      for (const [tripId, count] of tripCounts) {
        await this.db
          .update(trips)
          .set({
            locationPointsCount: sql`${trips.locationPointsCount} + ${count}`,
          })
          .where(eq(trips.id, tripId));
      }

      // Limpiar el buffer DESPUÉS de escribir exitosamente
      this.buffer.clear();
    } catch (error) {
      this.logger.error('Failed to flush location buffer', error);
      // NO limpiar el buffer si falló — se reintentará en el próximo flush
    }
  }

  /**
   * Flush forzado de UN trip específico.
   * Se llama cuando el usuario termina el viaje.
   * Así no se pierden los últimos puntos.
   */
  async flushTrip(tripId: string): Promise<void> {
    const points = this.buffer.get(tripId);
    if (!points || points.length === 0) {
      this.buffer.delete(tripId);
      return;
    }

    this.logger.debug(
      `Final flush for trip ${tripId}: ${points.length} points`,
    );

    try {
      await this.db.insert(locationLogs).values(
        points.map((p) => ({
          tripId: p.tripId,
          latitude: p.latitude,
          longitude: p.longitude,
          accuracy: p.accuracy,
          speed: p.speed,
          heading: p.heading,
          altitude: p.altitude,
          deviceTimestamp: p.deviceTimestamp,
          batchId: `final-${tripId}`,
        })),
      );

      await this.db
        .update(trips)
        .set({
          locationPointsCount: sql`${trips.locationPointsCount} + ${points.length}`,
        })
        .where(eq(trips.id, tripId));
    } catch (error) {
      this.logger.error(`Failed to flush trip ${tripId}`, error);
    }

    this.buffer.delete(tripId);
  }

  /**
   * Cuántos puntos hay acumulados en total (para monitoring).
   */
  getBufferSize(): number {
    let total = 0;
    for (const points of this.buffer.values()) {
      total += points.length;
    }
    return total;
  }

  /**
   * Al apagar el servidor, flush todo lo pendiente.
   */
  async onModuleDestroy() {
    clearInterval(this.flushTimer);
    await this.flushAll();
    this.logger.log('LocationBuffer destroyed, final flush complete');
  }
}
