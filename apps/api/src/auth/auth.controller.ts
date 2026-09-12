import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { AuthSession, AuthTokens, OrganizationSummary } from '@nexo/types';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService, type AuthResult, type RequestMeta } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { SwitchOrganizationDto } from './dto/switch-organization.dto.js';
import type { AuthContext } from './types/auth.types.js';

/** Cookie carrying the refresh token. Never readable by JavaScript. */
const REFRESH_COOKIE = 'nexo_refresh';

/**
 * Scoped to the auth routes, so the refresh token is not attached to every
 * request to the API — it is only sent where it is actually needed.
 */
const REFRESH_COOKIE_PATH = '/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      // Unreadable from JavaScript: the refresh token must never be exposed to
      // XSS, which is exactly why it does not live in localStorage.
      httpOnly: true,
      // HTTPS-only in production; off locally so plain http://localhost works.
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      // Depends on the real deployment topology. 'lax' is right when the
      // frontend and API share a site (including localhost on two ports). A
      // cross-site deployment needs 'none', which browsers only accept together
      // with secure: true. See docs/SECURITY.md.
      sameSite: (this.config.get<string>('COOKIE_SAMESITE') ?? 'lax') as CookieOptions['sameSite'],
      path: REFRESH_COOKIE_PATH,
    };
  }

  private setRefreshCookie(response: Response, result: AuthResult): void {
    response.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...this.cookieOptions(),
      expires: result.expiresAt,
    });
  }

  private clearRefreshCookie(response: Response): void {
    // Options must match those used to set it, or the browser keeps the cookie.
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  private static meta(request: Request): RequestMeta {
    return {
      userAgent: request.get('user-agent') ?? null,
      ipAddress: request.ip ?? null,
    };
  }

  /**
   * There is no public registration: Nexo is an internal platform, and accounts
   * are created by administrators. Rate limited hard because this is where
   * credential stuffing lands.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokens> {
    const result = await this.auth.login(dto, AuthController.meta(request));

    this.setRefreshCookie(response, result);

    return result.payload;
  }

  /** Rotates the refresh token. The old one stops working immediately. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokens> {
    const token: unknown = request.cookies?.[REFRESH_COOKIE];

    let result: AuthResult;

    try {
      result = await this.auth.refresh(typeof token === 'string' ? token : undefined);
    } catch (error) {
      // A refused refresh always leaves the browser without a stale cookie.
      this.clearRefreshCookie(response);
      throw error;
    }

    this.setRefreshCookie(response, result);

    return result.payload;
  }

  @Get('me')
  me(@CurrentUser() auth: AuthContext): Promise<AuthSession> {
    return this.auth.me(auth);
  }

  /**
   * Organizations the caller may switch into.
   *
   * The interface needs this to decide whether to offer a switcher at all;
   * `/auth/me` only reports the active one. Returns id, name and slug only.
   */
  @Get('organizations')
  listOrganizations(@CurrentUser() auth: AuthContext): Promise<OrganizationSummary[]> {
    return this.auth.listOrganizations(auth);
  }

  /** Revokes the server-side session, not just the browser cookie. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(auth);
    this.clearRefreshCookie(response);
  }

  /** Revokes every active session of the user, on every device. */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ revoked: number }> {
    const result = await this.auth.logoutAll(auth);

    this.clearRefreshCookie(response);

    return result;
  }

  /** Moves the current session into another organization the user belongs to. */
  @Post('switch-organization')
  @HttpCode(HttpStatus.OK)
  async switchOrganization(
    @Body() dto: SwitchOrganizationDto,
    @CurrentUser() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokens> {
    const result = await this.auth.switchOrganization(auth, dto.organizationId);

    this.setRefreshCookie(response, result);

    return result.payload;
  }
}
