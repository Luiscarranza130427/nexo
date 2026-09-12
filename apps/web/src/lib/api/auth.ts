import type { AuthSession, AuthTokens, LoginRequest, OrganizationSummary } from '@nexo/types';
import { ApiError } from './errors';
import { apiFetch, refreshSession as sharedRefresh } from './client';

/**
 * Typed calls to the auth endpoints.
 *
 * Login and refresh pass `skipRefresh`: a 401 from either means the credentials
 * or the cookie are bad, and retrying through a refresh would be pointless.
 */

export function login(credentials: LoginRequest): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/login', {
    method: 'POST',
    body: credentials,
    skipRefresh: true,
  });
}

/**
 * Restores the session from the refresh cookie.
 *
 * Goes through the client's shared refresh so it can never race a concurrent
 * one — two rotations of the same token look like reuse to the API and revoke
 * the session. Rejects when there is no usable session, which callers treat as
 * "not signed in" rather than as an error.
 */
export async function refreshSession(): Promise<AuthTokens> {
  const session = await sharedRefresh();

  if (!session) {
    throw new ApiError(401, 'UNAUTHORIZED', 'No active session.');
  }

  return session;
}

export function fetchSession(): Promise<AuthSession> {
  return apiFetch<AuthSession>('/auth/me');
}

export function fetchOrganizations(): Promise<OrganizationSummary[]> {
  return apiFetch<OrganizationSummary[]>('/auth/organizations');
}

export function logout(): Promise<null> {
  return apiFetch<null>('/auth/logout', { method: 'POST' });
}

export function logoutAll(): Promise<{ revoked: number }> {
  return apiFetch<{ revoked: number }>('/auth/logout-all', { method: 'POST' });
}

export function switchOrganization(organizationId: string): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/auth/switch-organization', {
    method: 'POST',
    body: { organizationId },
  });
}
