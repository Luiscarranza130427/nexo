import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../database/database.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { MembershipService } from './membership.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { TokenService } from './token.service.js';

/**
 * Authentication, sessions and role checks.
 *
 * Both guards are registered globally: routes are authenticated by default and
 * only open with `@Public()`. JwtAuthGuard runs first and populates the request
 * context; RolesGuard then enforces `@Roles(...)` against the database.
 *
 * JwtModule is registered empty on purpose — access and refresh tokens use
 * different secrets, so each secret is passed explicitly at sign and verify
 * time by TokenService rather than being baked into one module default.
 */
@Module({
  imports: [DatabaseModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    MembershipService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [MembershipService, PasswordService],
})
export class AuthModule {}
