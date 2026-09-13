import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes in base64url: 43 URL-safe characters, 256 bits of entropy. */
const TOKEN_BYTES = 32;

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

export function generateInvitationToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * The fingerprint stored in place of the token: SHA-256, as for refresh
 * tokens. The token is already high-entropy, so a slow hash would add nothing,
 * and a database leak yields no usable link.
 *
 * Tokens are found by an indexed lookup on this fingerprint. That equality
 * check leaks nothing useful: guessing a fingerprint does not reveal a token.
 */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Rejects anything that cannot be a token before it reaches the database. */
export function isWellFormedToken(value: string): boolean {
  return TOKEN_FORMAT.test(value);
}
