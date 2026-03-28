import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from 'src/db/drizzle.provider';
import { locationLogs, trips } from 'src/db/schema';

@Injectable()
export class TripService {
  private readonly logger: Logger;

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {
    this.logger = new Logger(TripService.name);
  }

  async createTrip(
    userId: string,
    dto: typeof trips.$inferInsert,
    subscriptionStatus: string | null,
  ) {
    const activeTrip = await this.getActiveTrip(userId);
    if (activeTrip) {
      throw new BadRequestException(
        'Ya tienes un viaje activo. Termínalo antes de iniciar otro.',
      );
    }

    if (dto.audioEnabled || dto.routeDeviationEnabled) {
      if (subscriptionStatus !== 'active') {
        throw new ForbiddenException(
          'Las funciones de audio y desvío de ruta requieren suscripción premium.',
        );
      }
    }

    const shareToken = this.generateShareToken();

    const [trip] = await this.db
      .insert(trips)
      .values({
        id: crypto.randomUUID(),
        userId,
        externalApp: dto.externalApp as any,
        driverPlate: dto.driverPlate || null,
        driverName: dto.driverName || null,
        vehicleColor: dto.vehicleColor || null,
        audioEnabled: dto.audioEnabled ?? false,
        routeDeviationEnabled: dto.routeDeviationEnabled ?? false,
        shareToken,
        status: 'active',
      })
      .returning();

    return {
      tripId: trip.id,
      shareToken: trip.shareToken,
      startedAt: trip.startedAt,
    };
  }

  async getActiveTrip(userId: string) {
    const result = await this.db
      .select()
      .from(trips)
      .where(and(eq(trips.userId, userId), eq(trips.status, 'active')))
      .limit(1);

    return result[0] || null;
  }

  async endTrip(tripId: string, userId: string) {
    const trip = await this.findTripOrFail(tripId, userId);

    if (trip.status !== 'active') {
      throw new BadRequestException('Este viaje ya fue finalizado.');
    }

    const endedAt = new Date();
    const startedAt = new Date(trip.startedAt!);
    const durationSeconds = Math.floor(
      (endedAt.getTime() - startedAt.getTime()) / 1000,
    );

    const distanceMeters = await this.calculateDistance(tripId);

    const [updated] = await this.db
      .update(trips)
      .set({
        status: 'completed',
        endedAt,
        durationSeconds,
        distanceMeters,
      })
      .where(eq(trips.id, tripId))
      .returning();

    return updated;
  }

  async getHistory(
    userId: string,
    query: { page?: number; limit?: number },
    isPremium: boolean,
  ) {
    const page = query.page ?? 1;
    let limit = query.limit ?? 10;

    if (!isPremium) {
      limit = Math.min(limit, 10);
    }

    const offset = (page - 1) * limit;

    const [tripsResult, countResult] = await Promise.all([
      this.db
        .select()
        .from(trips)
        .where(eq(trips.userId, userId))
        .orderBy(desc(trips.startedAt))
        .limit(limit)
        .offset(isPremium ? offset : 0),
      this.db
        .select({ total: count() })
        .from(trips)
        .where(eq(trips.userId, userId)),
    ]);

    const total = isPremium
      ? Number(countResult[0]?.total ?? 0)
      : Math.min(Number(countResult[0]?.total ?? 0), 10);

    return {
      trips: tripsResult,
      total,
      page: isPremium ? page : 1,
      totalPages: isPremium ? Math.ceil(total / limit) : 1,
    };
  }

  async getTripDetail(tripId: string, userId: string) {
    const trip = await this.findTripOrFail(tripId, userId);

    const logs = await this.db
      .select()
      .from(locationLogs)
      .where(eq(locationLogs.tripId, tripId))
      .orderBy(locationLogs.deviceTimestamp);

    return {
      ...trip,
      locationLogs: logs,
    };
  }

  async getTripByShareToken(shareToken: string) {
    const result = await this.db
      .select({
        id: trips.id,
        status: trips.status,
        externalApp: trips.externalApp,
        driverPlate: trips.driverPlate,
        driverName: trips.driverName,
        vehicleColor: trips.vehicleColor,
        shareToken: trips.shareToken,
        startedAt: trips.startedAt,
        endedAt: trips.endedAt,
        durationSeconds: trips.durationSeconds,
      })
      .from(trips)
      .where(eq(trips.shareToken, shareToken))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('Viaje no encontrado.');
    }

    return result[0];
  }

  async rateTrip(tripId: string, userId: string, rating: number) {
    const trip = await this.findTripOrFail(tripId, userId);

    if (trip.status === 'active') {
      throw new BadRequestException(
        'No puedes calificar un viaje que aún está activo.',
      );
    }

    await this.db
      .update(trips)
      .set({ userRating: rating })
      .where(eq(trips.id, tripId));

    return { tripId, rating };
  }

  private async findTripOrFail(tripId: string, userId: string) {
    const result = await this.db
      .select()
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      throw new NotFoundException('Viaje no encontrado.');
    }

    return result[0];
  }

  private generateShareToken(): string {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  }

  private async calculateDistance(tripId: string): Promise<number> {
    const logs = await this.db
      .select({
        latitude: locationLogs.latitude,
        longitude: locationLogs.longitude,
      })
      .from(locationLogs)
      .where(eq(locationLogs.tripId, tripId))
      .orderBy(locationLogs.deviceTimestamp);

    if (logs.length < 2) return 0;

    let totalMeters = 0;
    for (let i = 1; i < logs.length; i++) {
      totalMeters += this.haversine(
        logs[i - 1].latitude,
        logs[i - 1].longitude,
        logs[i].latitude,
        logs[i].longitude,
      );
    }

    return Math.round(totalMeters);
  }

  private haversine(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
