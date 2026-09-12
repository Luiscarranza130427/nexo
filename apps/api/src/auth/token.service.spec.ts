import { JwtService } from '@nestjs/jwt';
import { TokenService, parseDuration } from './token.service.js';

const ACCESS_SECRET = 'access-secret-for-tests';
const REFRESH_SECRET = 'refresh-secret-for-tests';

const config = {
  getOrThrow: (key: string) => (key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : REFRESH_SECRET),
  get: (key: string) => (key === 'JWT_ACCESS_TTL' ? '15m' : '7d'),
};

const claims = {
  sub: 'user-1',
  sessionId: 'session-1',
  organizationId: 'org-1',
};

describe('parseDuration', () => {
  it('converts the supported units', () => {
    expect(parseDuration('500ms')).toBe(500);
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('15m')).toBe(900_000);
    expect(parseDuration('2h')).toBe(7_200_000);
    expect(parseDuration('7d')).toBe(604_800_000);
  });

  it('rejects a malformed duration instead of guessing', () => {
    expect(() => parseDuration('soon')).toThrow();
    expect(() => parseDuration('15')).toThrow();
    expect(() => parseDuration('15y')).toThrow();
  });
});

describe('TokenService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokens = new TokenService(new JwtService({}), config as never);

  it('issues a verifiable access token carrying only the minimal claims', async () => {
    const token = await tokens.generateAccessToken(claims);
    const payload = await tokens.verifyAccessToken(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.sessionId).toBe('session-1');
    expect(payload.organizationId).toBe('org-1');
    // No profile or permission data belongs in a token.
    expect(Object.keys(payload).sort()).toEqual([
      'exp',
      'iat',
      'organizationId',
      'sessionId',
      'sub',
    ]);
  });

  it('issues a verifiable refresh token', async () => {
    const token = await tokens.generateRefreshToken(claims);

    await expect(tokens.verifyRefreshToken(token)).resolves.toMatchObject({ sub: 'user-1' });
  });

  it('never mints the same refresh token twice, even within one second', async () => {
    // Regression: with identical claims and second-resolution iat/exp, two
    // tokens issued in the same second used to come out byte-identical, which
    // made rotation a no-op and hid token reuse.
    const [first, second] = await Promise.all([
      tokens.generateRefreshToken(claims),
      tokens.generateRefreshToken(claims),
    ]);

    expect(first).not.toBe(second);
    expect(tokens.hashRefreshToken(first)).not.toBe(tokens.hashRefreshToken(second));
  });

  it('rejects a tampered token', async () => {
    const token = await tokens.generateAccessToken(claims);

    await expect(tokens.verifyAccessToken(`${token}x`)).rejects.toThrow();
  });

  it('does not accept an access token as a refresh token', async () => {
    // The two secrets differ precisely so this cannot work.
    const accessToken = await tokens.generateAccessToken(claims);

    await expect(tokens.verifyRefreshToken(accessToken)).rejects.toThrow();
  });

  it('does not accept a refresh token as an access token', async () => {
    const refreshToken = await tokens.generateRefreshToken(claims);

    await expect(tokens.verifyAccessToken(refreshToken)).rejects.toThrow();
  });

  it('fingerprints a refresh token as 64 hex characters and never stores it raw', async () => {
    const token = await tokens.generateRefreshToken(claims);
    const hash = tokens.hashRefreshToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });

  it('matches a token against its own fingerprint and rejects any other', async () => {
    const token = await tokens.generateRefreshToken(claims);
    const other = await tokens.generateRefreshToken({ ...claims, sessionId: 'session-2' });
    const hash = tokens.hashRefreshToken(token);

    expect(tokens.matchesStoredHash(token, hash)).toBe(true);
    expect(tokens.matchesStoredHash(other, hash)).toBe(false);
  });

  it('treats a malformed stored hash as a mismatch', async () => {
    const token = await tokens.generateRefreshToken(claims);

    expect(tokens.matchesStoredHash(token, 'garbage')).toBe(false);
  });
});
