import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { TokenPayload } from './types/auth.types.js';

/** Claims we produce; `iat` and `exp` are added by the signer. */
type TokenClaims = Pick<TokenPayload, 'sub' | 'sessionId' | 'organizationId'>;

const DURATION_FACTORS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parses a duration such as `15m`, `7d` or `3600s` into milliseconds.
 *
 * Having one parser means a malformed TTL fails loudly at startup instead of
 * silently producing a token that never expires.
 */
export function parseDuration(value: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid duration "${value}". Expected a form like "15m" or "7d".`);
  }

  return Number(match[1]) * DURATION_FACTORS[match[2]];
}

/**
 * Issues and verifies the two token kinds, and fingerprints refresh tokens.
 *
 * Access and refresh tokens are signed with **different secrets**, so a leaked
 * access secret cannot be used to mint refresh tokens.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get accessSecret(): string {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private get refreshSecret(): string {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  /** Lifetime of an access token in milliseconds. */
  accessTtlMs(): number {
    return parseDuration(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m');
  }

  /** Lifetime of a refresh token in milliseconds, for cookie and row expiry. */
  refreshTtlMs(): number {
    return parseDuration(this.config.get<string>('JWT_REFRESH_TTL') ?? '7d');
  }

  generateAccessToken(claims: TokenClaims): Promise<string> {
    return this.jwt.signAsync(claims, {
      secret: this.accessSecret,
      // Seconds, not a duration string: jsonwebtoken types the string form as a
      // narrow literal, and going through parseDuration keeps one source of truth.
      expiresIn: Math.floor(this.accessTtlMs() / 1_000),
    });
  }

  /**
   * Every refresh token carries a fresh `jti`.
   *
   * The other claims are identical across rotations of one session, and
   * `iat`/`exp` only have second resolution, so without a unique id two tokens
   * issued in the same second would be the same string — rotation would be a
   * no-op and reuse detection would never fire.
   */
  generateRefreshToken(claims: TokenClaims): Promise<string> {
    return this.jwt.signAsync(
      { ...claims, jti: randomUUID() },
      {
        secret: this.refreshSecret,
        expiresIn: Math.floor(this.refreshTtlMs() / 1_000),
      },
    );
  }

  verifyAccessToken(token: string): Promise<TokenPayload> {
    return this.jwt.verifyAsync<TokenPayload>(token, { secret: this.accessSecret });
  }

  verifyRefreshToken(token: string): Promise<TokenPayload> {
    return this.jwt.verifyAsync<TokenPayload>(token, { secret: this.refreshSecret });
  }

  /**
   * Fingerprints a refresh token for storage.
   *
   * SHA-256 is the right tool here, not Argon2: the token is a high-entropy
   * random value, so there is nothing to brute-force, and this runs on every
   * refresh where a deliberately slow hash would only add latency.
   */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Constant-time comparison of a presented token against a stored fingerprint. */
  matchesStoredHash(token: string, storedHash: string): boolean {
    const computed = Buffer.from(this.hashRefreshToken(token), 'hex');
    const stored = Buffer.from(storedHash, 'hex');

    if (computed.length !== stored.length) {
      return false;
    }

    return timingSafeEqual(computed, stored);
  }
}
