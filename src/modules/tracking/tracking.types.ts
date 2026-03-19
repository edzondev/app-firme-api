// src/modules/tracking/tracking.types.ts

// === EVENTOS QUE EL FRONTEND ENVÍA AL BACKEND ===

export interface ClientToServerEvents {
  // El usuario inicia un viaje y se une al room
  join_trip: (data: JoinTripPayload) => void;

  // Un contacto quiere ver la ubicación (se une al room de tracking)
  join_tracking: (data: JoinTrackingPayload) => void;

  // El usuario envía su GPS (cada 5-10 segundos)
  gps_update: (data: GPSUpdatePayload) => void;

  // El usuario activa el SOS
  sos_trigger: (data: SOSTriggerPayload) => void;

  // El usuario termina el viaje
  end_trip: (data: EndTripPayload) => void;

  // Ping para mantener la conexión viva
  heartbeat: () => void;
}

// === EVENTOS QUE EL BACKEND ENVÍA AL FRONTEND ===

export interface ServerToClientEvents {
  // Ubicación actualizada (la reciben los contactos)
  location_update: (data: LocationUpdatePayload) => void;

  // SOS fue activado (la reciben los contactos)
  sos_activated: (data: SOSActivatedPayload) => void;

  // El viaje terminó
  trip_ended: (data: { tripId: string }) => void;

  // Confirmaciones
  joined_trip: (data: { tripId: string; shareToken: string }) => void;
  joined_tracking: (data: { shareToken: string }) => void;

  // Errores
  error: (data: { message: string; code: string }) => void;
}

// === PAYLOADS ===

export interface JoinTripPayload {
  tripId: string;
  shareToken: string;
}

export interface JoinTrackingPayload {
  shareToken: string;
}

export interface GPSUpdatePayload {
  tripId: string;
  shareToken: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  timestamp: string; // ISO string del dispositivo
}

export interface SOSTriggerPayload {
  tripId: string;
  shareToken: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export interface EndTripPayload {
  tripId: string;
}

export interface LocationUpdatePayload {
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  timestamp: string;
}

export interface SOSActivatedPayload {
  tripId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  userName: string;
}
