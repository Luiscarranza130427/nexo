'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Error boundary for the application tree.
 *
 * Shows what happened in human terms and nothing more: the digest identifies
 * the error in the server logs, while stack traces and messages stay out of the
 * interface.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Kept so a real error is not silently swallowed during development.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <TriangleAlert className="size-6" aria-hidden="true" />
      </span>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Algo ha salido mal</h1>
        <p className="text-muted-foreground max-w-sm text-sm text-pretty">
          No hemos podido cargar esta página. Puedes reintentarlo o volver al inicio.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground text-xs">Referencia: {error.digest}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} className="gap-2">
          <RotateCcw className="size-4" aria-hidden="true" />
          Reintentar
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Volver al dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
