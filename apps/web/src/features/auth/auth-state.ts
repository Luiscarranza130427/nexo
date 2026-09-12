import type {
  AuthSession,
  AuthenticatedUser,
  MembershipSummary,
  OrganizationSummary,
} from '@nexo/types';

export type AuthState = {
  user: AuthenticatedUser | null;
  organization: OrganizationSummary | null;
  membership: MembershipSummary | null;
  isAuthenticated: boolean;
  /** True only while the initial session restore is in flight. */
  isLoading: boolean;
};

/** Nothing known yet: the bootstrap has not finished. */
export const INITIAL_AUTH_STATE: AuthState = {
  user: null,
  organization: null,
  membership: null,
  isAuthenticated: false,
  isLoading: true,
};

/** Bootstrap finished and there is no session. */
export const SIGNED_OUT_STATE: AuthState = { ...INITIAL_AUTH_STATE, isLoading: false };

/**
 * Projects an API session onto the client state.
 *
 * Kept in a plain module, away from the provider's JSX, so the shape of the
 * authenticated state can be asserted directly.
 */
export function stateFromSession(session: AuthSession): AuthState {
  return {
    user: session.user,
    organization: session.organization,
    membership: session.membership,
    isAuthenticated: true,
    isLoading: false,
  };
}
