import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from './db/drizzle.provider';
import { sql } from 'drizzle-orm';

@Injectable()
export class AppService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async health() {
    // Verifica que la conexión a la DB funciona
    const result = await this.db.execute(sql`SELECT NOW() as now`);
    return {
      status: 'ok',
      database: 'connected',
      timestamp: result[0].now,
    };
  }
}
