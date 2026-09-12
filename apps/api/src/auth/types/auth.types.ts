/**
 * Backend-only authentication types.
 *
 * These describe JWT payloads and request context. Anything a browser needs to
 * know lives in `@nexo/types` instead.
 */

/**
 * Claims carried by both token kinds.
 *
 * Deliberately minimal: who, which session, which organization. No email, no
 * name, no role — a token bears identity, it is not a cache of profile or
 * permission data. The role is always re-read from the database, so a changed
 * or revoked membership takes effect on the next request rather than at expiry.
 */
export type TokenPayload = {
  /** User id. */
  sub: string;
  /** Session row this token belongs to. */
  sessionId: string;
  /** Organization the session is currently acting in. */
  organizationId: string;
  /** Issued at, seconds since epoch. Added by the signer. */
  iat?: number;
  /** Expiry, seconds since epoch. Added by the signer. */
  exp?: number;
  /**
   * Unique token id. Present on refresh tokens only.
   *
   * Without it, two refresh tokens minted for the same session within the same
   * second would be byte-identical — `iat` and `exp` only have second
   * resolution — and rotation would silently hand back the very same token.
   */
  jti?: string;
};

/** Context attached to the request once an access token has been validated. */
export type AuthContext = {
  userId: string;
  sessionId: string;
  organizationId: string;
};
