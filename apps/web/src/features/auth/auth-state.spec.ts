import type { AuthSession } from '@nexo/types';
import { INITIAL_AUTH_STATE, SIGNED_OUT_STATE, stateFromSession } from './auth-state';

const SESSION: AuthSession = {
  user: {
    id: 'user-1',
    email: 'dev@novatec.local',
    firstName: 'Luis',
    lastName: 'Carranza',
    avatarUrl: null,
  },
  organization: { id: 'org-1', name: 'NovaTec', slug: 'novatec' },
  membership: { role: 'OWNER' },
};

describe('auth state', () => {
  it('starts loading and unauthenticated', () => {
    expect(INITIAL_AUTH_STATE.isLoading).toBe(true);
    expect(INITIAL_AUTH_STATE.isAuthenticated).toBe(false);
    expect(INITIAL_AUTH_STATE.user).toBeNull();
  });

  it('settles to signed out once the bootstrap finishes with no session', () => {
    expect(SIGNED_OUT_STATE.isLoading).toBe(false);
    expect(SIGNED_OUT_STATE.isAuthenticated).toBe(false);
  });

  it('projects a session onto authenticated state', () => {
    const state = stateFromSession(SESSION);

    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.user?.email).toBe('dev@novatec.local');
    expect(state.organization?.name).toBe('NovaTec');
    expect(state.membership?.role).toBe('OWNER');
  });

  it('carries no token: the access token lives in memory, outside React state', () => {
    const state = stateFromSession(SESSION);

    expect(Object.keys(state).sort()).toEqual([
      'isAuthenticated',
      'isLoading',
      'membership',
      'organization',
      'user',
    ]);
    expect(JSON.stringify(state)).not.toContain('accessToken');
  });
});
