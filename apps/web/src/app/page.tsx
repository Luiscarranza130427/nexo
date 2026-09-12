'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useAuth } from '@/features/auth/auth-provider';

/**
 * The root route is a router, not a page.
 *
 * There is no public landing in this phase: people either have a session and
 * belong in the app, or they need to sign in.
 */
export default function RootPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    router.replace(isAuthenticated ? '/dashboard' : '/login');
  }, [isAuthenticated, isLoading, router]);

  return <LoadingScreen />;
}
