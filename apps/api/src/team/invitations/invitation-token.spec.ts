import {
  generateInvitationToken,
  hashInvitationToken,
  isWellFormedToken,
} from './invitation-token.js';

describe('invitation tokens', () => {
  it('are 43 URL-safe characters and never repeat', () => {
    const tokens = new Set(Array.from({ length: 200 }, generateInvitationToken));

    expect(tokens.size).toBe(200);

    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(isWellFormedToken(token)).toBe(true);
    }
  });

  it('are stored as a SHA-256 fingerprint that is stable and unlike the token', () => {
    const token = generateInvitationToken();
    const hash = hashInvitationToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashInvitationToken(token));
    expect(hash).not.toContain(token);
    expect(hashInvitationToken(generateInvitationToken())).not.toBe(hash);
  });

  it('rejects malformed values before any lookup', () => {
    for (const value of ['', 'short', 'a'.repeat(44), `${'a'.repeat(42)}=`, '../../etc/passwd']) {
      expect(isWellFormedToken(value)).toBe(false);
    }
  });
});
