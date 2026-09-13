import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { OrganizationModule } from './organization/organization.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { TeamModule } from './team/team.module.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [
    // Loads .env once and exposes ConfigService application-wide, so no module
    // has to reach into process.env on its own.
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      // ConfigModule is global, but ThrottlerAsyncOptions requires `imports`.
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Baseline for every route. Auth endpoints tighten it with @Throttle;
        // ordinary endpoints must not be crippled by an absurdly low ceiling.
        throttlers: [{ ttl: 60_000, limit: 120 }],
        // The end-to-end suite performs many deliberate logins in seconds.
        // Only the test runner sets this; it must never be true in production.
        skipIf: () => config.get<string>('THROTTLE_DISABLED') === 'true',
      }),
    }),
    DatabaseModule,
    AuthModule,
    ClientsModule,
    OrganizationModule,
    ProjectsModule,
    TasksModule,
    TeamModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
