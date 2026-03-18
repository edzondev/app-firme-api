CREATE TYPE "public"."contact_relationship" AS ENUM('madre', 'padre', 'pareja', 'hermano', 'hermana', 'amigo', 'amiga', 'hijo', 'hija', 'otro');--> statement-breakpoint
CREATE TYPE "public"."external_app" AS ENUM('indrive', 'uber', 'didi', 'yango', 'cabify', 'maxim', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_method" AS ENUM('push', 'sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."sos_channel" AS ENUM('push', 'sms', 'whatsapp', 'call');--> statement-breakpoint
CREATE TYPE "public"."sos_status" AS ENUM('active', 'resolved', 'false_alarm');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('free', 'active', 'expired', 'cancelled', 'grace_period');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('active', 'completed', 'sos_triggered', 'cancelled');--> statement-breakpoint
CREATE TABLE "emergency_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"relationship" "contact_relationship" DEFAULT 'otro',
	"linked_user_id" uuid,
	"priority" integer DEFAULT 0,
	"notify_on_trip_start" boolean DEFAULT false,
	"notify_method" "notification_method" DEFAULT 'push',
	"contact_push_token" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"member_user_id" uuid NOT NULL,
	"nickname" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "location_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy" real,
	"speed" real,
	"heading" real,
	"altitude" real,
	"device_timestamp" timestamp with time zone NOT NULL,
	"batch_id" text,
	"recorded_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sos_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid,
	"user_id" uuid NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy" real,
	"status" "sos_status" DEFAULT 'active',
	"message" text,
	"triggered_at" timestamp with time zone DEFAULT now(),
	"resolved_at" timestamp with time zone,
	"resolution_note" text
);
--> statement-breakpoint
CREATE TABLE "sos_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sos_alert_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"channel" "sos_channel" NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now(),
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" text,
	"provider_message_id" text
);
--> statement-breakpoint
CREATE TABLE "trip_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"storage_provider" text DEFAULT 'r2',
	"storage_key" text NOT NULL,
	"chunk_number" integer DEFAULT 0,
	"duration_seconds" integer,
	"file_size_bytes" bigint,
	"encryption_algorithm" text DEFAULT 'AES-256-GCM',
	"encryption_key_hash" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"external_app" "external_app" NOT NULL,
	"driver_plate" text,
	"driver_name" text,
	"vehicle_color" text,
	"status" "trip_status" DEFAULT 'active',
	"audio_enabled" boolean DEFAULT false,
	"share_enabled" boolean DEFAULT true,
	"route_deviation_enabled" boolean DEFAULT false,
	"share_token" text,
	"started_at" timestamp with time zone DEFAULT now(),
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"distance_meters" real,
	"location_points_count" integer DEFAULT 0,
	"user_rating" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "trips_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"avatar_url" text,
	"rc_customer_id" text,
	"subscription_status" "subscription_status" DEFAULT 'free',
	"subscription_product_id" text,
	"subscription_expires_at" timestamp with time zone,
	"subscription_store" text,
	"subscription_started_at" timestamp with time zone,
	"expo_push_token" text,
	"settings_audio_quality" text DEFAULT 'normal',
	"settings_sos_delay" integer DEFAULT 3,
	"settings_dark_mode" boolean DEFAULT false,
	"settings_notifications_enabled" boolean DEFAULT true,
	"custom_sos_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"last_active_at" timestamp with time zone DEFAULT now(),
	"is_deleted" boolean DEFAULT false,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_rc_customer_id_unique" UNIQUE("rc_customer_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_member_user_id_users_id_fk" FOREIGN KEY ("member_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_logs" ADD CONSTRAINT "location_logs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos_notifications" ADD CONSTRAINT "sos_notifications_sos_alert_id_sos_alerts_id_fk" FOREIGN KEY ("sos_alert_id") REFERENCES "public"."sos_alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos_notifications" ADD CONSTRAINT "sos_notifications_contact_id_emergency_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."emergency_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_recordings" ADD CONSTRAINT "trip_recordings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contacts_user" ON "emergency_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_family_unique" ON "family_members" USING btree ("owner_user_id","member_user_id");--> statement-breakpoint
CREATE INDEX "idx_location_trip" ON "location_logs" USING btree ("trip_id","device_timestamp");--> statement-breakpoint
CREATE INDEX "idx_sos_user" ON "sos_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sos_trip" ON "sos_alerts" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "idx_sos_notif_alert" ON "sos_notifications" USING btree ("sos_alert_id");--> statement-breakpoint
CREATE INDEX "idx_recordings_trip" ON "trip_recordings" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "idx_trips_user" ON "trips" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_trips_share_token" ON "trips" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "idx_users_firebase" ON "users" USING btree ("firebase_uid");--> statement-breakpoint
CREATE INDEX "idx_webhook_source" ON "webhook_logs" USING btree ("source","received_at");