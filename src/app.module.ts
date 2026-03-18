import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './db/drizzle.module';
import { FirebaseModule } from './firebase/firebase.module';
import { FirebaseAuthGuard } from './common/guards/firebase-auth/firebase-auth.guard';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DrizzleModule,
    FirebaseModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
    AppService,
  ],
})
export class AppModule {}
