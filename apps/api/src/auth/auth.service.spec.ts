import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { HttpException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { LoginDto } from './dto/login.dto.js';

/** Reads the machine-readable `code` out of a thrown Nest exception. */
function codeOf(error: unknown): string | undefined {
  const body = (error as HttpException).getResponse();

  return typeof body === 'object' && body !== null ? (body as { code?: string }).code : undefined;
}

const ORG = { id: 'org-1', name: 'NovaTec', slug: 'novatec' };
const OTHER_ORG = { id: 'org-2', name: 'Other', slug: 'other' };

const CONTEXT = {
  user: {
    id: 'user-1',
    email: 'dev@novatec.local',
    firstName: 'Luis',
    lastName: 'Carranza',
    avatarUrl: null,
  },
  organization: ORG,
  membership: { role: 'OWNER' as const },
};

const ACTIVE_USER = {
  id: 'user-1',
  email: 'dev@novatec.local',
  status: 'ACTIVE',
  passwordHash: '$argon2id$stored-hash',
};

function build(overrides: {
  user?: unknown;
  passwordMatches?: boolean;
  organizations?: (typeof ORG)[];
  session?: unknown;
  matchesStoredHash?: boolean;
  context?: unknown;
}) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(overrides.user ?? null) },
  };
  const passwords = {
    hash: vi.fn().mockResolvedValue('$argon2id$dummy'),
    verify: vi.fn().mockResolvedValue(overrides.passwordMatches ?? true),
  };
  const tokens = {
    generateAccessToken: vi.fn().mockResolvedValue('access-token'),
    verifyRefreshToken: vi.fn().mockResolvedValue({ sessionId: 'session-1' }),
    matchesStoredHash: vi.fn().mockReturnValue(overrides.matchesStoredHash ?? true),
  };
  const sessions = {
    issue: vi
      .fn()
      .mockResolvedValue({ sessionId: 'session-1', refreshToken: 'r1', expiresAt: new Date() }),
    rotate: vi
      .fn()
      .mockResolvedValue({ sessionId: 'session-1', refreshToken: 'r2', expiresAt: new Date() }),
    findById: vi.fn().mockResolvedValue(overrides.session ?? null),
    revoke: vi.fn().mockResolvedValue(undefined),
    revokeAllForUser: vi.fn().mockResolvedValue(3),
  };
  const memberships = {
    listOrganizations: vi.fn().mockResolvedValue(overrides.organizations ?? [ORG]),
    resolve: vi
      .fn()
      .mockResolvedValue(overrides.context === undefined ? CONTEXT : overrides.context),
  };

  const service = new AuthService(
    prisma as never,
    passwords as never,
    tokens as never,
    sessions as never,
    memberships as never,
  );

  return { service, prisma, passwords, tokens, sessions, memberships };
}

const LOGIN: LoginDto = { email: 'dev@novatec.local', password: 'a-long-enough-passphrase' };

describe('AuthService.login', () => {
  it('signs in a valid user and issues a session', async () => {
    const { service, sessions } = build({ user: ACTIVE_USER });

    const result = await service.login(LOGIN, {});

    expect(result.payload.accessToken).toBe('access-token');
    expect(result.payload.user.email).toBe('dev@novatec.local');
    expect(result.payload.membership.role).toBe('OWNER');
    expect(result.refreshToken).toBe('r1');
    expect(sessions.issue).toHaveBeenCalledOnce();
  });

  it('never leaks the password hash in the response', async () => {
    const { service } = build({ user: ACTIVE_USER });

    const result = await service.login(LOGIN, {});

    expect(JSON.stringify(result.payload)).not.toContain('argon2');
    expect(JSON.stringify(result.payload)).not.toContain('passwordHash');
  });

  it('rejects an unknown email with the generic code', async () => {
    const { service } = build({ user: null });

    await expect(service.login(LOGIN, {})).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login(LOGIN, {}).catch(codeOf)).resolves.toBe('INVALID_CREDENTIALS');
  });

  it('still runs a hash verification for an unknown email, to keep timing flat', async () => {
    const { service, passwords } = build({ user: null });

    await service.login(LOGIN, {}).catch(() => undefined);

    // Without this, a missing account would answer measurably faster.
    expect(passwords.verify).toHaveBeenCalledOnce();
  });

  it('rejects a wrong password with the same code as an unknown email', async () => {
    const { service } = build({ user: ACTIVE_USER, passwordMatches: false });

    await expect(service.login(LOGIN, {}).catch(codeOf)).resolves.toBe('INVALID_CREDENTIALS');
  });

  it('rejects a user that has no password set', async () => {
    const { service } = build({ user: { ...ACTIVE_USER, passwordHash: null } });

    await expect(service.login(LOGIN, {}).catch(codeOf)).resolves.toBe('INVALID_CREDENTIALS');
  });

  it('rejects an inactive user, without revealing that the password was right', async () => {
    const { service } = build({ user: { ...ACTIVE_USER, status: 'INACTIVE' } });

    await expect(service.login(LOGIN, {}).catch(codeOf)).resolves.toBe('INVALID_CREDENTIALS');
  });

  it('rejects a user with no organization membership', async () => {
    const { service } = build({ user: ACTIVE_USER, organizations: [] });

    await expect(service.login(LOGIN, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.login(LOGIN, {}).catch(codeOf)).resolves.toBe('INVALID_ORGANIZATION');
  });

  it('asks which organization when the user belongs to several', async () => {
    const { service } = build({ user: ACTIVE_USER, organizations: [ORG, OTHER_ORG] });

    await expect(service.login(LOGIN, {})).rejects.toBeInstanceOf(ConflictException);
    await expect(service.login(LOGIN, {}).catch(codeOf)).resolves.toBe('ORGANIZATION_REQUIRED');
  });

  it('offers only id, name and slug when asking for an organization', async () => {
    const { service } = build({ user: ACTIVE_USER, organizations: [ORG, OTHER_ORG] });

    const body = await service
      .login(LOGIN, {})
      .catch((error: unknown) => (error as ConflictException).getResponse());

    expect(body).toMatchObject({ organizations: [ORG, OTHER_ORG] });
  });

  it('refuses an organization the user does not belong to', async () => {
    const { service } = build({ user: ACTIVE_USER, organizations: [ORG] });

    const attempt = service.login({ ...LOGIN, organizationId: 'org-999' }, {});

    await expect(attempt.catch(codeOf)).resolves.toBe('INVALID_ORGANIZATION');
  });

  it('checks credentials before revealing anything about organizations', async () => {
    const { service, memberships } = build({ user: ACTIVE_USER, passwordMatches: false });

    await service.login(LOGIN, {}).catch(() => undefined);

    expect(memberships.listOrganizations).not.toHaveBeenCalled();
  });
});

describe('AuthService.refresh', () => {
  const activeSession = {
    id: 'session-1',
    userId: 'user-1',
    organizationId: 'org-1',
    refreshTokenHash: 'stored-hash',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
  };

  it('rotates the token for a valid session', async () => {
    const { service, sessions } = build({ session: activeSession });

    const result = await service.refresh('a-refresh-token');

    expect(result.refreshToken).toBe('r2');
    expect(sessions.rotate).toHaveBeenCalledOnce();
  });

  it('rejects a missing cookie', async () => {
    const { service } = build({});

    await expect(service.refresh(undefined).catch(codeOf)).resolves.toBe('UNAUTHORIZED');
  });

  it('rejects a session that no longer exists', async () => {
    const { service } = build({ session: null });

    await expect(service.refresh('token').catch(codeOf)).resolves.toBe('UNAUTHORIZED');
  });

  it('rejects a revoked session', async () => {
    const { service } = build({ session: { ...activeSession, revokedAt: new Date() } });

    await expect(service.refresh('token').catch(codeOf)).resolves.toBe('SESSION_REVOKED');
  });

  it('rejects an expired session', async () => {
    const { service } = build({
      session: { ...activeSession, expiresAt: new Date(Date.now() - 1_000) },
    });

    await expect(service.refresh('token').catch(codeOf)).resolves.toBe('SESSION_EXPIRED');
  });

  it('revokes the session when a previously rotated token is replayed', async () => {
    const { service, sessions } = build({ session: activeSession, matchesStoredHash: false });

    await expect(service.refresh('old-token').catch(codeOf)).resolves.toBe('SESSION_REVOKED');
    // Reuse means the token leaked or the client misbehaved: kill the session.
    expect(sessions.revoke).toHaveBeenCalledWith('session-1');
    expect(sessions.rotate).not.toHaveBeenCalled();
  });

  it('refuses to refresh when the membership is gone', async () => {
    const { service } = build({ session: activeSession, context: null });

    await expect(service.refresh('token').catch(codeOf)).resolves.toBe('UNAUTHORIZED');
  });
});

describe('AuthService.switchOrganization', () => {
  const auth = { userId: 'user-1', sessionId: 'session-1', organizationId: 'org-1' };

  it('moves the session to an organization the user belongs to', async () => {
    const { service, sessions } = build({});

    const result = await service.switchOrganization(auth, 'org-2');

    expect(result.refreshToken).toBe('r2');
    expect(sessions.rotate).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
      organizationId: 'org-2',
    });
  });

  it('refuses an organization the user does not belong to', async () => {
    const { service, sessions } = build({ context: null });

    await expect(service.switchOrganization(auth, 'org-999').catch(codeOf)).resolves.toBe(
      'INVALID_ORGANIZATION',
    );
    expect(sessions.rotate).not.toHaveBeenCalled();
  });
});

describe('AuthService.logout', () => {
  const auth = { userId: 'user-1', sessionId: 'session-1', organizationId: 'org-1' };

  it('revokes the current session server-side', async () => {
    const { service, sessions } = build({});

    await service.logout(auth);

    expect(sessions.revoke).toHaveBeenCalledWith('session-1');
  });

  it('revokes every session of the user', async () => {
    const { service, sessions } = build({});

    await expect(service.logoutAll(auth)).resolves.toEqual({ revoked: 3 });
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-1');
  });
});
