import { Global, Module } from '@nestjs/common';
import { DrizzleProvider, DRIZZLE } from './drizzle.provider';

@Global() // @Global() hace que el módulo esté disponible en TODA la app
@Module({
  providers: [DrizzleProvider],
  exports: [DRIZZLE], // Exporta para que otros módulos lo inyecten
})
export class DrizzleModule {}
