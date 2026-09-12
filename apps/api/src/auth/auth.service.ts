import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthSession, AuthTokens } from '@nexo/types';
import { PrismaService } from '../database/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import { MembershipService } from './membership.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';
import type { AuthContext } from './types/auth.types.js';

/** Where the request came from, recorded on the session for auditing. */
export type RequestMeta = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

/** Everything the controller needs: the JSON body plus the cookie material. */
export type AuthResult = {
  payload: AuthTokens;
  refreshToken: string;
  expiresAt: Date;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Lazily computed once; see `verifyAgainstDummyHash`. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly memberships: MembershipService,
  ) {}

  /**
   * Burns the same Argon2 work as a real verification.
   *
   * Without this, an unknown email would answer far faster than a known one
   * with a wrong password, and that timing difference alone is enough to
   * enumerate accounts.
   */
  private async verifyAgainstDummyHash(password: string): Promise<void> {
    this.dummyHash ??= this.passwords.hash(randomBytes(32).toString('hex'));
    await this.passwords.verify(await this.dummyHash, password);
  }

  private static invalidCredentials(): UnauthorizedException {
    // One message for "no such user", "wrong password", "no password set" and
    // "inactive account". The client must not be able to tell them apart.
    return new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials.',
    });
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user?.passwordHash) {
      await this.verifyAgainstDummyHash(dto.password);
      throw AuthService.invalidCredentials();
    }

    const passwordMatches = await this.passwords.verify(user.passwordHash, dto.password);

    if (!passwordMatches || user.status !== 'ACTIVE') {
      throw AuthService.invalidCredentials();
    }

    // Credentials are proven valid before anything about organizations is
    // revealed. Order matters: doing this earlier would leak membership data
    // to anyone guessing an email.
    const organizations = await this.memberships.listOrganizations(user.id);

    if (organizations.length === 0) {
      throw new ForbiddenException({
        code: 'INVALID_ORGANIZATION',
        message: 'No active organization membership.',
      });
    }

    let organizationId: string;

    if (dto.organizationId) {
      const chosen = organizations.find((organization) => organization.id === dto.organizationId);

      if (!chosen) {
        throw new ForbiddenException({
          code: 'INVALID_ORGANIZATION',
          message: 'You do not belong to that organization.',
        });
      }

      organizationId = chosen.id;
    } else if (organizations.length === 1) {
      organizationId = organizations[0].id;
    } else {
      // Never pick one silently: the caller must say which context it wants.
      // 409 rather than 400 — the request was well-formed and the credentials
      // were correct; what is missing is a decision about state.
      throw new ConflictException({
        code: 'ORGANIZATION_REQUIRED',
        message: 'Choose an organization to sign in to.',
        organizations,
      });
    }

    return this.startSession(user.id, organizationId, meta);
  }

  /** Issues a session plus both tokens for an already-authorized user. */
  private async startSession(
    userId: string,
    organizationId: string,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const context = await this.requireContext(userId, organizationId);
    const session = await this.sessions.issue({ userId, organizationId, ...meta });
    const accessToken = await this.tokens.generateAccessToken({
      sub: userId,
      sessionId: session.sessionId,
      organizationId,
    });

    return {
      payload: { ...context, accessToken },
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
    };
  }

  private async requireContext(userId: string, organizationId: string): Promise<AuthSession> {
    const context = await this.memberships.resolve(userId, organizationId);

    if (!context) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Not authenticated.' });
    }

    return context;
  }

  /**
   * Validates the presented refresh token and rotates it.
   *
   * Rotation means the previous token stops working the moment a new one is
   * issued, so a stolen token is useful only until the legitimate client
   * refreshes — at which point the theft becomes detectable.
   */
  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    const unauthorized = (code: string, message: string) =>
      new UnauthorizedException({ code, message });

    if (!refreshToken) {
      throw unauthorized('UNAUTHORIZED', 'Not authenticated.');
    }

    let sessionId: string;

    try {
      const payload = await this.tokens.verifyRefreshToken(refreshToken);
      sessionId = payload.sessionId;
    } catch {
      // Bad signature, malformed token or expired: all indistinguishable to the client.
      throw unauthorized('UNAUTHORIZED', 'Not authenticated.');
    }

    const session = await this.sessions.findById(sessionId);

    if (!session) {
      throw unauthorized('UNAUTHORIZED', 'Not authenticated.');
    }

    if (session.revokedAt !== null) {
      throw unauthorized('SESSION_REVOKED', 'Session is no longer valid.');
    }

    if (session.expiresAt <= new Date()) {
      throw unauthorized('SESSION_EXPIRED', 'Session has expired.');
    }

    if (!this.tokens.matchesStoredHash(refreshToken, session.refreshTokenHash)) {
      // The signature is valid but this is not the current token for the
      // session — it is a previously rotated one being replayed. Either it was
      // stolen or the legitimate client is replaying; both warrant killing the
      // session. Only the session id is logged, never the token.
      await this.sessions.revoke(session.id);
      this.logger.warn(`Refresh token reuse detected for session ${session.id}. Session revoked.`);
      throw unauthorized('SESSION_REVOKED', 'Session is no longer valid.');
    }

    // Re-checked on every refresh: a user deactivated or removed from the
    // organization mid-session cannot renew their access.
    const context = await this.requireContext(session.userId, session.organizationId);
    const rotated = await this.sessions.rotate({
      sessionId: session.id,
      userId: session.userId,
      organizationId: session.organizationId,
    });
    const accessToken = await this.tokens.generateAccessToken({
      sub: session.userId,
      sessionId: session.id,
      organizationId: session.organizationId,
    });

    return {
      payload: { ...context, accessToken },
      refreshToken: rotated.refreshToken,
      expiresAt: rotated.expiresAt,
    };
  }

  me(auth: AuthContext): Promise<AuthSession> {
    return this.requireContext(auth.userId, auth.organizationId);
  }

  async logout(auth: AuthContext): Promise<void> {
    await this.sessions.revoke(auth.sessionId);
  }

  async logoutAll(auth: AuthContext): Promise<{ revoked: number }> {
    const revoked = await this.sessions.revokeAllForUser(auth.userId);

    return { revoked };
  }

  /**
   * Moves the current session to another organization the user belongs to.
   *
   * The membership is verified against the database, so a client cannot switch
   * into an organization it has no access to by naming its id.
   */
  async switchOrganization(auth: AuthContext, organizationId: string): Promise<AuthResult> {
    const context = await this.memberships.resolve(auth.userId, organizationId);

    if (!context) {
      throw new ForbiddenException({
        code: 'INVALID_ORGANIZATION',
        message: 'You do not belong to that organization.',
      });
    }

    const rotated = await this.sessions.rotate({
      sessionId: auth.sessionId,
      userId: auth.userId,
      organizationId,
    });
    const accessToken = await this.tokens.generateAccessToken({
      sub: auth.userId,
      sessionId: auth.sessionId,
      organizationId,
    });

    return {
      payload: { ...context, accessToken },
      refreshToken: rotated.refreshToken,
      expiresAt: rotated.expiresAt,
    };
  }
}
