'use client';

import type { LoginRequest } from '@nexo/types';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  INITIAL_AUTH_STATE,
  SIGNED_OUT_STATE,
  stateFromSession,
  type AuthState,
} from './auth-state';
import * as authApi from '@/lib/api/auth';
import { setAccessToken, setSessionLostHandler } from '@/lib/api/client';

export type AuthContextValue = AuthState & {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshSession: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the authenticated session.
 *
 * Session state is deliberately React state rather than a TanStack Query cache:
 * it is not server data to be revalidated on a schedule, it is the identity
 * every other request depends on. TanStack Query handles the *business* data
 * that will arrive in later phases, and is invalidated when the organization
 * changes.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_AUTH_STATE);
  const queryClient = useQueryClient();

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setState(SIGNED_OUT_STATE);
  }, []);

  /**
   * Restores the session on load.
   *
   * The access token is gone after a reload — it only ever lived in memory — so
   * the HttpOnly refresh cookie is what proves the session. `/auth/refresh`
   * already returns the full session alongside the new token, so there is no
   * follow-up `/auth/me`: it would be a duplicate round trip on every page load.
   *
   * No re-entry guard is needed. Strict mode runs this twice in development,
   * but both runs await the same shared refresh, so the API sees one request.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const tokens = await authApi.refreshSession();

        if (cancelled) {
          return;
        }

        setAccessToken(tokens.accessToken);
        setState(stateFromSession(tokens));
      } catch {
        // No cookie, expired or revoked: simply not signed in. Not an error.
        if (!cancelled) {
          clearSession();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  /** The API client calls this when a refresh fails mid-session. */
  useEffect(() => {
    setSessionLostHandler(() => {
      clearSession();
      queryClient.clear();
    });

    return () => setSessionLostHandler(null);
  }, [clearSession, queryClient]);

  const login = useCallback(async (credentials: LoginRequest) => {
    const tokens = await authApi.login(credentials);

    setAccessToken(tokens.accessToken);
    setState(stateFromSession(tokens));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Even if the call fails, the local session must go: the server-side
      // session is revoked or unreachable either way.
      clearSession();
      queryClient.clear();
    }
  }, [clearSession, queryClient]);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      clearSession();
      queryClient.clear();
    }
  }, [clearSession, queryClient]);

  const refreshSession = useCallback(async () => {
    const tokens = await authApi.refreshSession();

    setAccessToken(tokens.accessToken);
    setState(stateFromSession(tokens));
  }, []);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      const tokens = await authApi.switchOrganization(organizationId);

      setAccessToken(tokens.accessToken);
      setState(stateFromSession(tokens));
      // Everything cached belonged to the previous organization.
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, logoutAll, refreshSession, switchOrganization }),
    [state, login, logout, logoutAll, refreshSession, switchOrganization],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }

  return context;
}
