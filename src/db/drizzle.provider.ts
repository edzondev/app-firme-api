import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');

// Este es el tipo que usarás en tus servicios para tipar la DB.
export type DrizzleDB = PostgresJsDatabase<typeof schema>;

export const DrizzleProvider = {
  provide: DRIZZLE,
  useFactory: () => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }

    // Crear conexión con postgres.js
    // max: 10 limita las conexiones (Supabase free tier permite ~15)
    const client = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });

    // Crear instancia de Drizzle con el schema
    return drizzle(client, { schema });
  },
};
