'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useAuth } from '@/features/auth/auth-provider';

/**
 * Shell for every authenticated page.
 *
 * The redirect here is **user experience, not security**. The real boundary is
 * the NestJS API, which authenticates every request and re-reads the membership
 * from the database. This only spares people a screen full of empty state and a
 * cascade of 401s. See docs/SECURITY.md.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <LoadingScreen label="Restaurando sesión…" />;
  }

  // Rendering the shell before the redirect lands would flash protected chrome.
  if (!isAuthenticated) {
    return <LoadingScreen label="Redirigiendo…" />;
  }

  return (
    <div className="flex min-h-dvh">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl space-y-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
