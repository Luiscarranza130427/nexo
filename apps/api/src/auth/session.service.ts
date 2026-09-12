import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { TokenService } from './token.service.js';

/** A freshly issued or rotated session and its refresh token. */
export type IssuedSession = {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
};

/** What the caller needs to know about a stored session. */
export type StoredSession = {
  id: string;
  userId: string;
  organizationId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

/**
 * Owns the lifecycle of refresh sessions: create, rotate, revoke.
 *
 * A session row is the server-side half of a login. Because it exists,
 * a refresh token can be revoked — which a bare JWT never can.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Creates a session and the refresh token that points at it.
   *
   * The id is generated up front so the token can carry it, letting the row be
   * written once with its fingerprint already in place.
   */
  async issue(params: {
    userId: string;
    organizationId: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<IssuedSession> {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.tokens.refreshTtlMs());
    const refreshToken = await this.tokens.generateRefreshToken({
      sub: params.userId,
      sessionId,
      organizationId: params.organizationId,
    });

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: params.userId,
        organizationId: params.organizationId,
        refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
        userAgent: params.userAgent ?? null,
        ipAddress: params.ipAddress ?? null,
        expiresAt,
      },
    });

    return { sessionId, refreshToken, expiresAt };
  }

  findById(sessionId: string): Promise<StoredSession | null> {
    return this.prisma.session.findUnique({ where: { id: sessionId } });
  }

  /** True when the session is usable right now. */
  isUsable(session: StoredSession, now: Date = new Date()): boolean {
    return session.revokedAt === null && session.expiresAt > now;
  }

  /**
   * Issues a new refresh token for an existing session and replaces the stored
   * fingerprint, which invalidates the previous token immediately.
   *
   * `organizationId` is written too, so switching organization moves the
   * session rather than leaving a stale context behind.
   */
  async rotate(params: {
    sessionId: string;
    userId: string;
    organizationId: string;
  }): Promise<IssuedSession> {
    const expiresAt = new Date(Date.now() + this.tokens.refreshTtlMs());
    const refreshToken = await this.tokens.generateRefreshToken({
      sub: params.userId,
      sessionId: params.sessionId,
      organizationId: params.organizationId,
    });

    await this.prisma.session.update({
      where: { id: params.sessionId },
      data: {
        refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
        organizationId: params.organizationId,
        expiresAt,
      },
    });

    return { sessionId: params.sessionId, refreshToken, expiresAt };
  }

  /** Marks a session revoked. Idempotent: re-revoking is a no-op. */
  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revokes every active session of a user. Returns how many were revoked. */
  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return result.count;
  }
}
