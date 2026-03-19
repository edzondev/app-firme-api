import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ConfigService } from '@nestjs/config';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');

// Este es el tipo que usarás en tus servicios para tipar la DB.
export type DrizzleDB = PostgresJsDatabase<typeof schema>;

export const DrizzleProvider = {
  provide: DRIZZLE,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const connectionString = configService.getOrThrow('DATABASE_URL');

    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }

    const client = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });

    return drizzle(client, { schema });
  },
};
