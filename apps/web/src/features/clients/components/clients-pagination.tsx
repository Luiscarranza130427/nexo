'use client';

import type { PaginationMeta } from '@nexo/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Server-side pagination controls.
 *
 * The API returns the page and the totals; nothing is sliced in the browser.
 */
export function ClientsPagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (meta.totalPages <= 1) {
    return null;
  }

  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <nav
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
      aria-label="Paginación de clientes"
    >
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Mostrando {from}–{to} de {meta.total}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
          className="gap-1"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Anterior
        </Button>
        <span className="text-muted-foreground px-2 text-sm">
          Página {meta.page} de {meta.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
          className="gap-1"
        >
          Siguiente
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
