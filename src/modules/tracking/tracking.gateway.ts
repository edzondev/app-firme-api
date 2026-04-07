import { Inject, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { eq } from 'drizzle-orm';
import { Server, Socket } from 'socket.io';
import type {
  GPSUpdatePayload,
  JoinTripPayload,
  JoinTrackingPayload,
  SOSTriggerPayload,
  EndTripPayload,
} from './tracking.types';
import { LocationBuffer } from './location/location.buffer';
import { FirebaseAdminProvider } from 'src/firebase/firebase.provider';
import { DRIZZLE, type DrizzleDB } from 'src/db/drizzle.provider';
import { users } from 'src/db/schema';
import { SosService } from '../sos/sos.service';

@WebSocketGateway({
  namespace: '/tracking',
  cors: {
    origin: '*',
  },
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly buffer: LocationBuffer,
    private readonly firebase: FirebaseAdminProvider,
    private readonly sosService: SosService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client connected: ${client.id}`);
      const token = client.handshake.auth?.token;

      if (!token) {
        this.logger.warn(`Client ${client.id}: no token, disconnecting`);
        client.emit('error', { message: 'Token requerido', code: 'NO_TOKEN' });
        client.disconnect();
        return;
      }

      const decoded = await this.firebase.verifyToken(token);

      const [dbUser] = await this.db
        .select({
          id: users.id,
          subscriptionStatus: users.subscriptionStatus,
        })
        .from(users)
        .where(eq(users.firebaseUid, decoded.uid))
        .limit(1);

      client.data.userId = dbUser?.id ?? null;
      client.data.firebaseUid = decoded.uid;
      client.data.email = decoded.email;
      client.data.subscriptionStatus = dbUser?.subscriptionStatus ?? null;

      this.logger.log(
        `Client connected: ${client.id} (user: ${dbUser?.id ?? decoded.uid})`,
      );
    } catch (error) {
      this.logger.warn(`Client ${client.id}: invalid token, disconnecting`);
      client.emit('error', {
        message: 'Token inválido',
        code: 'INVALID_TOKEN',
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // EVENTOS DEL USUARIO (rider)

  @SubscribeMessage('join_trip')
  handleJoinTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinTripPayload,
  ) {
    client.join(`trip:${data.tripId}`);
    client.join(`share:${data.shareToken}`);

    client.data.tripId = data.tripId;
    client.data.shareToken = data.shareToken;

    this.logger.log(
      `User ${client.data.userId} joined trip ${data.tripId}`,
    );

    client.emit('joined_trip', {
      tripId: data.tripId,
      shareToken: data.shareToken,
    });
  }

  @SubscribeMessage('gps_update')
  handleGPSUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GPSUpdatePayload,
  ) {
    this.server.to(`share:${data.shareToken}`).emit('location_update', {
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed,
      heading: data.heading,
      timestamp: data.timestamp,
    });

    this.buffer.add({
      tripId: data.tripId,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
      speed: data.speed,
      heading: data.heading,
      altitude: data.altitude,
      deviceTimestamp: new Date(data.timestamp),
    });
  }

  @SubscribeMessage('sos_trigger')
  async handleSOS(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SOSTriggerPayload,
  ) {
    this.logger.warn(
      `SOS TRIGGERED by ${client.data.userId} at ${data.latitude},${data.longitude}`,
    );

    this.server.to(`share:${data.shareToken}`).emit('sos_activated', {
      tripId: data.tripId,
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: new Date().toISOString(),
      userName: client.data.email || 'Usuario',
    });

    const result = await this.sosService.triggerSOS(
      client.data.userId,
      client.data.subscriptionStatus,
      {
        tripId: data.tripId,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy || undefined,
      },
    );

    return {
      status: 'sos_received',
      sosAlertId: result.sosAlertId,
      timestamp: new Date().toISOString(),
    };
  }

  @SubscribeMessage('end_trip')
  async handleEndTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: EndTripPayload,
  ) {
    this.logger.log(`Trip ${data.tripId} ended by ${client.data.userId}`);

    await this.buffer.flushTrip(data.tripId);

    const shareToken = client.data.shareToken;
    if (shareToken) {
      this.server
        .to(`share:${shareToken}`)
        .emit('trip_ended', { tripId: data.tripId });
    }

    client.leave(`trip:${data.tripId}`);
    if (shareToken) client.leave(`share:${shareToken}`);

    client.data.tripId = undefined;
    client.data.shareToken = undefined;
  }

  // EVENTOS DEL CONTACTO (viewer)

  @SubscribeMessage('join_tracking')
  handleJoinTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinTrackingPayload,
  ) {
    client.join(`share:${data.shareToken}`);

    this.logger.log(
      `Viewer ${client.id} joined tracking for ${data.shareToken}`,
    );

    client.emit('joined_tracking', { shareToken: data.shareToken });
  }

  // HEARTBEAT

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    return { timestamp: Date.now() };
  }
}
