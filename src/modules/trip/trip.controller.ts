import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { TripService } from './trip.service';
import { trips } from 'src/db/schema';
import { CurrentUser } from 'src/common/decorators/current-user/current-user.decorator';
import { Public } from 'src/common/decorators/public/public.decorator';

@Controller('trip')
export class TripController {
  constructor(private readonly tripsService: TripService) {}

  @Post()
  async createTrip(
    @CurrentUser('userId') userId: string,
    @CurrentUser('subscriptionStatus') subscriptionStatus: string | null,
    @Body() dto: typeof trips.$inferInsert,
  ) {
    return this.tripsService.createTrip(userId, dto, subscriptionStatus);
  }

  @Patch(':tripId/end')
  async endTrip(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
  ) {
    return this.tripsService.endTrip(tripId, userId);
  }

  @Get('active')
  async getActiveTrip(@CurrentUser('userId') userId: string) {
    const trip = await this.tripsService.getActiveTrip(userId);
    return trip || { active: false };
  }

  @Get('history')
  async getHistory(
    @CurrentUser('userId') userId: string,
    @CurrentUser('subscriptionStatus') subscriptionStatus: string | null,
    @Query() query: { page?: number; limit?: number },
  ) {
    const isPremium = subscriptionStatus === 'active';
    return this.tripsService.getHistory(userId, query, isPremium);
  }

  @Public()
  @Get('share/:shareToken')
  async getTripByShareToken(@Param('shareToken') shareToken: string) {
    return this.tripsService.getTripByShareToken(shareToken);
  }

  @Get(':tripId')
  async getTripDetail(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
  ) {
    return this.tripsService.getTripDetail(tripId, userId);
  }

  @Patch(':tripId/rate')
  async rateTrip(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body() dto: { rating: number },
  ) {
    return this.tripsService.rateTrip(tripId, userId, dto.rating);
  }
}
