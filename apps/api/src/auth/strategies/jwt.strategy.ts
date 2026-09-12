import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SessionService } from '../session.service.js';
import type { AuthContext, TokenPayload } from '../types/auth.types.js';

/**
 * Validates the access token on every protected request.
 *
 * A valid signature is not enough. The session row is re-read from the database
 * so that logout, logout-all and expiry take effect immediately instead of
 * waiting for the access token to run out. That costs one primary-key lookup
 * per request, which is the right trade for revocation that actually works.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly sessions: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: TokenPayload): Promise<AuthContext> {
    const session = await this.sessions.findById(payload.sessionId);

    if (!session) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated.',
      });
    }

    if (session.revokedAt !== null) {
      throw new UnauthorizedException({
        code: 'SESSION_REVOKED',
        message: 'Session is no longer valid.',
      });
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Session has expired.',
      });
    }

    // Defence in depth: the signature already guarantees these, but a token
    // whose subject disagrees with its session is never legitimate.
    if (session.userId !== payload.sub) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated.',
      });
    }

    // The session row is the source of truth for the active organization.
    // After switch-organization the session moves, so access tokens minted for
    // the previous organization stop working straight away.
    if (session.organizationId !== payload.organizationId) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated.',
      });
    }

    return {
      userId: session.userId,
      sessionId: session.id,
      organizationId: session.organizationId,
    };
  }
}
