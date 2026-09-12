'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useAuth } from '@/features/auth/auth-provider';

/** Signed-in people have no business on the login screen. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <LoadingScreen label="Restaurando sesión…" />;
  }

  return <>{children}</>;
}
