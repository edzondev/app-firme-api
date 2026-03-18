import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  real,
  timestamp,
  bigserial,
  doublePrecision,
  pgEnum,
  jsonb,
  bigint,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ====== ENUMS ======
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'free',
  'active',
  'expired',
  'cancelled',
  'grace_period',
]);
export const tripStatusEnum = pgEnum('trip_status', [
  'active',
  'completed',
  'sos_triggered',
  'cancelled',
]);
export const sosStatusEnum = pgEnum('sos_status', [
  'active',
  'resolved',
  'false_alarm',
]);
export const sosChannelEnum = pgEnum('sos_channel', [
  'push',
  'sms',
  'whatsapp',
  'call',
]);
export const externalAppEnum = pgEnum('external_app', [
  'indrive',
  'uber',
  'didi',
  'yango',
  'cabify',
  'maxim',
  'other',
]);
export const contactRelationshipEnum = pgEnum('contact_relationship', [
  'madre',
  'padre',
  'pareja',
  'hermano',
  'hermana',
  'amigo',
  'amiga',
  'hijo',
  'hija',
  'otro',
]);
export const notificationMethodEnum = pgEnum('notification_method', [
  'push',
  'sms',
  'whatsapp',
]);

// ====== USERS ======
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firebaseUid: text('firebase_uid').unique().notNull(),
    fullName: text('full_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    avatarUrl: text('avatar_url'),

    // RevenueCat
    rcCustomerId: text('rc_customer_id').unique(),
    subscriptionStatus: subscriptionStatusEnum('subscription_status').default(
      'free',
    ),
    subscriptionProductId: text('subscription_product_id'),
    subscriptionExpiresAt: timestamp('subscription_expires_at', {
      withTimezone: true,
    }),
    subscriptionStore: text('subscription_store'),
    subscriptionStartedAt: timestamp('subscription_started_at', {
      withTimezone: true,
    }),

    // Push
    expoPushToken: text('expo_push_token'),

    // Settings
    settingsAudioQuality: text('settings_audio_quality').default('normal'),
    settingsSosDelay: integer('settings_sos_delay').default(3),
    settingsDarkMode: boolean('settings_dark_mode').default(false),
    settingsNotificationsEnabled: boolean(
      'settings_notifications_enabled',
    ).default(true),
    customSosMessage: text('custom_sos_message'),

    // Meta
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    lastActiveAt: timestamp('last_active_at', {
      withTimezone: true,
    }).defaultNow(),
    isDeleted: boolean('is_deleted').default(false),
  },
  (t) => [index('idx_users_firebase').on(t.firebaseUid)],
);

// ====== EMERGENCY CONTACTS ======
export const emergencyContacts = pgTable(
  'emergency_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    relationship: contactRelationshipEnum('relationship').default('otro'),
    linkedUserId: uuid('linked_user_id').references(() => users.id),
    priority: integer('priority').default(0),
    notifyOnTripStart: boolean('notify_on_trip_start').default(false),
    notifyMethod: notificationMethodEnum('notify_method').default('push'),
    contactPushToken: text('contact_push_token'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_contacts_user').on(t.userId)],
);

// ====== TRIPS ======
export const trips = pgTable(
  'trips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    externalApp: externalAppEnum('external_app').notNull(),
    driverPlate: text('driver_plate'),
    driverName: text('driver_name'),
    vehicleColor: text('vehicle_color'),
    status: tripStatusEnum('status').default('active'),
    audioEnabled: boolean('audio_enabled').default(false),
    shareEnabled: boolean('share_enabled').default(true),
    routeDeviationEnabled: boolean('route_deviation_enabled').default(false),
    shareToken: text('share_token').unique(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds'),
    distanceMeters: real('distance_meters'),
    locationPointsCount: integer('location_points_count').default(0),
    userRating: integer('user_rating'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_trips_user').on(t.userId),
    index('idx_trips_share_token').on(t.shareToken),
  ],
);

// ====== LOCATION LOGS ======
export const locationLogs = pgTable(
  'location_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    accuracy: real('accuracy'),
    speed: real('speed'),
    heading: real('heading'),
    altitude: real('altitude'),
    deviceTimestamp: timestamp('device_timestamp', {
      withTimezone: true,
    }).notNull(),
    batchId: text('batch_id'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_location_trip').on(t.tripId, t.deviceTimestamp)],
);

// ====== TRIP RECORDINGS ======
export const tripRecordings = pgTable(
  'trip_recordings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    storageProvider: text('storage_provider').default('r2'),
    storageKey: text('storage_key').notNull(),
    chunkNumber: integer('chunk_number').default(0),
    durationSeconds: integer('duration_seconds'),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    encryptionAlgorithm: text('encryption_algorithm').default('AES-256-GCM'),
    encryptionKeyHash: text('encryption_key_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_recordings_trip').on(t.tripId)],
);

// ====== SOS ALERTS ======
export const sosAlerts = pgTable(
  'sos_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id').references(() => trips.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    accuracy: real('accuracy'),
    status: sosStatusEnum('status').default('active'),
    message: text('message'),
    triggeredAt: timestamp('triggered_at', { withTimezone: true }).defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
  },
  (t) => [
    index('idx_sos_user').on(t.userId),
    index('idx_sos_trip').on(t.tripId),
  ],
);

// ====== SOS NOTIFICATIONS ======
export const sosNotifications = pgTable(
  'sos_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sosAlertId: uuid('sos_alert_id')
      .notNull()
      .references(() => sosAlerts.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => emergencyContacts.id),
    channel: sosChannelEnum('channel').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    providerMessageId: text('provider_message_id'),
  },
  (t) => [index('idx_sos_notif_alert').on(t.sosAlertId)],
);

// ====== FAMILY MEMBERS ======
export const familyMembers = pgTable(
  'family_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memberUserId: uuid('member_user_id')
      .notNull()
      .references(() => users.id),
    nickname: text('nickname'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex('idx_family_unique').on(t.ownerUserId, t.memberUserId)],
);

// ====== WEBHOOK LOGS ======
export const webhookLogs = pgTable(
  'webhook_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    processed: boolean('processed').default(false),
    error: text('error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_webhook_source').on(t.source, t.receivedAt)],
);
