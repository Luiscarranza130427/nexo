import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard.js';

type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER';

function contextFor(user: { userId: string; organizationId: string } | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function build(options: { required?: Role[]; actualRole?: Role | null }) {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(options.required) };
  const memberships = {
    resolve: vi
      .fn()
      .mockResolvedValue(options.actualRole ? { membership: { role: options.actualRole } } : null),
  };

  return {
    guard: new RolesGuard(reflector as never, memberships as never),
    memberships,
  };
}

const AUTH = { userId: 'user-1', organizationId: 'org-1' };

describe('RolesGuard', () => {
  it('allows a route without @Roles', async () => {
    const { guard, memberships } = build({ required: undefined });

    await expect(guard.canActivate(contextFor(AUTH))).resolves.toBe(true);
    // No role requirement means no database round trip.
    expect(memberships.resolve).not.toHaveBeenCalled();
  });

  it('allows an OWNER when OWNER is required', async () => {
    const { guard } = build({ required: ['OWNER'], actualRole: 'OWNER' });

    await expect(guard.canActivate(contextFor(AUTH))).resolves.toBe(true);
  });

  it('allows an ADMIN when OWNER or ADMIN are required', async () => {
    const { guard } = build({ required: ['OWNER', 'ADMIN'], actualRole: 'ADMIN' });

    await expect(guard.canActivate(contextFor(AUTH))).resolves.toBe(true);
  });

  it('blocks a MEMBER when OWNER or ADMIN are required', async () => {
    const { guard } = build({ required: ['OWNER', 'ADMIN'], actualRole: 'MEMBER' });

    await expect(guard.canActivate(contextFor(AUTH))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks a MANAGER when only OWNER is required', async () => {
    const { guard } = build({ required: ['OWNER'], actualRole: 'MANAGER' });

    await expect(guard.canActivate(contextFor(AUTH))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('matches roles exactly: there is no implicit hierarchy', async () => {
    // An OWNER is NOT admitted by @Roles(ADMIN). List every role that should pass.
    const { guard } = build({ required: ['ADMIN'], actualRole: 'OWNER' });

    await expect(guard.canActivate(contextFor(AUTH))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks when the membership no longer exists', async () => {
    const { guard } = build({ required: ['MEMBER'], actualRole: null });

    await expect(guard.canActivate(contextFor(AUTH))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('re-reads the role from the database rather than trusting the token', async () => {
    const { guard, memberships } = build({ required: ['OWNER'], actualRole: 'OWNER' });

    await guard.canActivate(contextFor(AUTH));

    expect(memberships.resolve).toHaveBeenCalledWith('user-1', 'org-1');
  });

  it('blocks an unauthenticated request', async () => {
    const { guard } = build({ required: ['OWNER'], actualRole: 'OWNER' });

    await expect(guard.canActivate(contextFor(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
