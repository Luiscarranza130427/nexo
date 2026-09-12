'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/features/auth/auth-provider';
import { ApiError } from '@/lib/api/errors';

/**
 * Every client-side provider, in one place and in a deliberate order:
 * theme first (it only touches the document), then the query cache, then auth —
 * which invalidates that cache when the organization changes.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // Created once per browser session, inside state so it survives re-renders
  // without being shared across server requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Business data is not volatile enough to justify constant refetching.
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Retrying an auth failure only produces noise: the API client has
              // already tried to refresh once and given up.
              if (error instanceof ApiError && [401, 403].includes(error.status)) {
                return false;
              }

              return failureCount < 1;
            },
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
