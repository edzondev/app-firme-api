import { Logger, UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
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
import { SosService } from '../sos/sos.service';

@WebSocketGateway({
  namespace: '/tracking',
  cors: {
    origin: '*', // En producción: restringir a tus dominios
  },
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TrackingGateway.name);

  // El objeto Server de Socket.io — lo usas para emitir a rooms
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly buffer: LocationBuffer,
    private readonly firebase: FirebaseAdminProvider,
    private readonly sosService: SosService,
  ) {}

  /**
   * Se ejecuta cuando un cliente se conecta al WebSocket.
   * Aquí verificamos el token de Firebase.
   */
  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client connected: ${client.id}`);
      // El token viene en client.handshake.auth.token
      // (lo envía el frontend al conectarse)
      const token = client.handshake.auth?.token;

      if (!token) {
        this.logger.warn(`Client ${client.id}: no token, disconnecting`);
        client.emit('error', { message: 'Token requerido', code: 'NO_TOKEN' });
        client.disconnect();
        return;
      }

      // Verificar con Firebase
      const decoded = await this.firebase.verifyToken(token);

      if (process.env.NODE_ENV === 'development') {
        console.log('Decoded token:', decoded);
      }
      // Guardar info del usuario en el socket para uso posterior
      client.data.firebaseUid = decoded.uid;
      client.data.email = decoded.email;

      this.logger.log(`Client connected: ${client.id} (user: ${decoded.uid})`);
    } catch (error) {
      this.logger.warn(`Client ${client.id}: invalid token, disconnecting`);
      client.emit('error', {
        message: 'Token inválido',
        code: 'INVALID_TOKEN',
      });
      client.disconnect();
    }
  }

  /**
   * Se ejecuta cuando un cliente se desconecta.
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // EVENTOS DEL USUARIO (rider)

  /**
   * El usuario inicia un viaje y se une al room.
   * Evento: 'join_trip'
   */
  @SubscribeMessage('join_trip')
  handleJoinTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinTripPayload,
  ) {
    // Unir al room del trip (para recibir eventos del viaje)
    client.join(`trip:${data.tripId}`);

    // Unir al room del shareToken (para que contactos lo encuentren)
    client.join(`share:${data.shareToken}`);

    // Guardar en el socket para referencia futura
    client.data.tripId = data.tripId;
    client.data.shareToken = data.shareToken;

    this.logger.log(
      `User ${client.data.firebaseUid} joined trip ${data.tripId}`,
    );

    // Confirmar al cliente
    client.emit('joined_trip', {
      tripId: data.tripId,
      shareToken: data.shareToken,
    });
  }

  /**
   * GPS update del usuario (cada 5-10 segundos).
   * Este es el evento más frecuente.
   * Evento: 'gps_update'
   */
  @SubscribeMessage('gps_update')
  handleGPSUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GPSUpdatePayload,
  ) {
    // 1. BROADCAST INMEDIATO a todos los contactos que están viendo
    this.server.to(`share:${data.shareToken}`).emit('location_update', {
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed,
      heading: data.heading,
      timestamp: data.timestamp,
    });

    // 2. ACUMULAR en el buffer (se escribirá a DB cada 30s)
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

  /**
   * SOS activado — máxima prioridad.
   * Evento: 'sos_trigger'
   */
  @SubscribeMessage('sos_trigger')
  async handleSOS(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SOSTriggerPayload,
  ) {
    this.logger.warn(
      `SOS TRIGGERED by ${client.data.firebaseUid} at ${data.latitude},${data.longitude}`,
    );

    // 1. Broadcast INMEDIATO a todos los contactos
    this.server.to(`share:${data.shareToken}`).emit('sos_activated', {
      tripId: data.tripId,
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: new Date().toISOString(),
      userName: client.data.email || 'Usuario',
    });

    const result = await this.sosService.triggerSOS(client.data.firebaseUid, {
      tripId: data.tripId,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy || undefined,
    });

    // Confirmar al usuario
    return {
      status: 'sos_received',
      sosAlertId: result.sosAlertId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * El usuario termina el viaje.
   * Evento: 'end_trip'
   */
  @SubscribeMessage('end_trip')
  async handleEndTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: EndTripPayload,
  ) {
    this.logger.log(`Trip ${data.tripId} ended by ${client.data.firebaseUid}`);

    // 1. Flush forzado: escribir los últimos GPS a la DB
    await this.buffer.flushTrip(data.tripId);

    // 2. Notificar a todos los que estaban viendo
    const shareToken = client.data.shareToken;
    if (shareToken) {
      this.server
        .to(`share:${shareToken}`)
        .emit('trip_ended', { tripId: data.tripId });
    }

    // 3. Salir de los rooms
    client.leave(`trip:${data.tripId}`);
    if (shareToken) client.leave(`share:${shareToken}`);

    // 4. Limpiar data del socket
    client.data.tripId = undefined;
    client.data.shareToken = undefined;
  }

  // ============================================
  // EVENTOS DEL CONTACTO (viewer)
  // ============================================

  /**
   * Un contacto quiere ver la ubicación de alguien.
   * Evento: 'join_tracking'
   */
  @SubscribeMessage('join_tracking')
  handleJoinTracking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinTrackingPayload,
  ) {
    // Unir al room del shareToken
    client.join(`share:${data.shareToken}`);

    this.logger.log(
      `Viewer ${client.id} joined tracking for ${data.shareToken}`,
    );

    client.emit('joined_tracking', { shareToken: data.shareToken });
  }

  // ============================================
  // HEARTBEAT
  // ============================================

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    return { timestamp: Date.now() };
  }
}
