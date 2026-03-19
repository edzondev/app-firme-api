import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { TripService } from './trip.service';
import { trips } from 'src/db/schema';
import { CurrentUser } from 'src/common/decorators/current-user/current-user.decorator';
import { Public } from 'src/common/decorators/public/public.decorator';

@Controller('trip')
export class TripController {
  constructor(private readonly tripsService: TripService) {}

  /**
   * POST /api/v1/trips
   * Crear un nuevo viaje protegido.
   * Retorna tripId + shareToken para iniciar tracking.
   */
  @Post()
  async createTrip(
    @CurrentUser('firebaseUid') firebaseUid: string,
    @Body() dto: typeof trips.$inferInsert,
  ) {
    // Necesitamos el userId de la DB, no el firebaseUid
    // El AuthGuard pone firebaseUid en request.user
    // Pero trips.userId es el UUID de nuestra tabla users
    // Opción: buscar el user por firebaseUid aquí
    // TODO: cuando refactorices, el AuthGuard debería poner el userId de la DB en request.user
    return this.tripsService.createTrip(firebaseUid, dto);
  }

  /**
   * PATCH /api/v1/trips/:tripId/end
   * Finalizar un viaje activo.
   * Calcula duración y distancia automáticamente.
   */
  @Patch(':tripId/end')
  async endTrip(
    @CurrentUser('firebaseUid') firebaseUid: string,
    @Param('tripId') tripId: string,
  ) {
    return this.tripsService.endTrip(tripId, firebaseUid);
  }

  /**
   * GET /api/v1/trips/active
   * Obtener el viaje activo del usuario (si existe).
   * Útil para restaurar estado si la app se cierra durante un viaje.
   */
  @Get('active')
  async getActiveTrip(@CurrentUser('firebaseUid') firebaseUid: string) {
    const trip = await this.tripsService.getActiveTrip(firebaseUid);
    return trip || { active: false };
  }

  /**
   * GET /api/v1/trips/history
   * Historial de viajes.
   * Free = últimos 10. Premium = paginado ilimitado.
   */
  @Get('history')
  async getHistory(
    @CurrentUser('firebaseUid') firebaseUid: string,
    @Query()
    query: typeof trips.$inferSelect & { page?: number; limit?: number },
  ) {
    // TODO: obtener isPremium del usuario real
    // Por ahora hardcoded false para MVP
    const isPremium = false;
    return this.tripsService.getHistory(firebaseUid, query, isPremium);
  }

  /**
   * GET /api/v1/trips/share/:shareToken
   * Info del viaje para el link público de tracking.
   * NO requiere autenticación — cualquiera con el link puede ver.
   */
  @Public()
  @Get('share/:shareToken')
  async getTripByShareToken(@Param('shareToken') shareToken: string) {
    return this.tripsService.getTripByShareToken(shareToken);
  }

  /**
   * GET /api/v1/trips/:tripId
   * Detalle completo de un viaje con todos los location_logs.
   * IMPORTANTE: esta ruta va DESPUÉS de /active y /history
   * para que Express no confunda "active" con un :tripId.
   */
  @Get(':tripId')
  async getTripDetail(
    @CurrentUser('firebaseUid') firebaseUid: string,
    @Param('tripId') tripId: string,
  ) {
    return this.tripsService.getTripDetail(tripId, firebaseUid);
  }

  /**
   * PATCH /api/v1/trips/:tripId/rate
   * Calificar un viaje terminado (1-5).
   */
  @Patch(':tripId/rate')
  async rateTrip(
    @CurrentUser('firebaseUid') firebaseUid: string,
    @Param('tripId') tripId: string,
    @Body() dto: { rating: number },
  ) {
    return this.tripsService.rateTrip(tripId, firebaseUid, dto.rating);
  }
}
