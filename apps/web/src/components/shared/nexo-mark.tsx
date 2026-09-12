import { cn } from '@/lib/utils';

/**
 * The Nexo mark: a typographic monogram, not an image.
 *
 * There is no official Nexo logo yet and none was invented — the "N" monogram
 * plus the wordmark is deliberately simple so it can be replaced by a real
 * asset without touching anything else.
 */
export function NexoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
        'bg-primary text-primary-foreground font-semibold',
        'ring-brand-accent/30 ring-1',
        className,
      )}
    >
      N
    </span>
  );
}

/** Mark plus wordmark. `subtitle` adds the product line under the name. */
export function NexoWordmark({
  className,
  subtitle = false,
}: {
  className?: string;
  subtitle?: boolean;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <NexoMark />
      <span className="flex flex-col leading-none">
        <span className="text-foreground text-base font-semibold tracking-tight">Nexo</span>
        {subtitle ? (
          <span className="text-muted-foreground mt-1 text-[11px] font-medium">
            Internal Operations Platform
          </span>
        ) : null}
      </span>
    </span>
  );
}

/** Parent-brand attribution. Deliberately quiet — Nexo leads, NovaTec supports. */
export function NovaTecAttribution({ className }: { className?: string }) {
  return (
    <p className={cn('text-muted-foreground text-xs', className)}>
      A <span className="text-foreground/70 font-medium">NovaTec</span> Product
    </p>
  );
}
