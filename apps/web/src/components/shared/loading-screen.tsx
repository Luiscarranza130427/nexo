import { NexoMark } from '@/components/shared/nexo-mark';

/**
 * Full-screen state while the session is being restored.
 *
 * Branded rather than blank, but intentionally plain — this shows for a few
 * hundred milliseconds, and an elaborate animation would only make the app feel
 * slower than it is.
 */
export function LoadingScreen({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <NexoMark className="animate-pulse" />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}
