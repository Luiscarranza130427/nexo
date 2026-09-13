'use client';

import type { Invitation, InvitationListQuery, InvitationStatus } from '@nexo/types';
import { MailPlus, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { PaginationControls } from '@/components/shared/pagination-controls';
import { SearchInput } from '@/components/shared/search-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpdateSearchParams } from '@/hooks/use-update-search-params';
import { errorMessage } from '@/lib/api/errors';
import { useInvitationsQuery } from '../hooks/use-team';
import { INVITATION_STATUSES, INVITATION_STATUS_LABELS } from '../labels';
import { InvitationsTable } from './invitations-table';
import { RevokeInvitationDialog } from './revoke-invitation-dialog';

const PAGE_SIZE = 20;

/** Sentinel for "no filter": Radix Select cannot hold an empty string value. */
const ANY = 'ANY';

export function InvitationsPanel({ onInvite }: { onInvite: () => void }) {
  const searchParams = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const [revoking, setRevoking] = useState<Invitation | null>(null);

  const query: InvitationListQuery = useMemo(() => {
    const status = searchParams.get('status');

    return {
      page: Math.max(1, Number(searchParams.get('page')) || 1),
      limit: PAGE_SIZE,
      search: searchParams.get('search') ?? '',
      status:
        status && (INVITATION_STATUSES as string[]).includes(status)
          ? (status as InvitationStatus)
          : undefined,
    };
  }, [searchParams]);

  const { data, isPending, isError, error } = useInvitationsQuery(query);

  const onSearch = useCallback((search: string) => updateParams({ search }), [updateParams]);
  const clearFilters = () => updateParams({ search: undefined, status: undefined });
  const hasFilters = Boolean(query.search || query.status);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={query.search ?? ''}
          onSearch={onSearch}
          placeholder="Buscar por correo"
          label="Buscar invitaciones"
          className="sm:max-w-sm sm:flex-1"
        />
        <Select
          value={query.status ?? ANY}
          onValueChange={(value) => updateParams({ status: value === ANY ? undefined : value })}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos los estados</SelectItem>
            {INVITATION_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {INVITATION_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button variant="ghost" onClick={clearFilters} className="gap-2 sm:ml-auto">
            <X className="size-4" aria-hidden="true" />
            Limpiar filtros
          </Button>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs">
        Cada enlace solo se muestra al crear su invitación. Si uno se pierde, revoca la invitación y
        crea otra.
      </p>

      {isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      ) : isPending ? (
        <div className="space-y-3" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : data.data.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={MailPlus}
            title="No hay invitaciones con estos filtros."
            description="Prueba con otro correo o quita los filtros aplicados."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={MailPlus}
            title="No hay invitaciones pendientes."
            description="Invita a alguien para darle acceso a tu organización."
            action={
              <Button onClick={onInvite} className="gap-2">
                <MailPlus className="size-4" aria-hidden="true" />
                Invitar miembro
              </Button>
            }
          />
        )
      ) : (
        <>
          <InvitationsTable invitations={data.data} onRevoke={setRevoking} />
          <PaginationControls
            label="Paginación de invitaciones"
            meta={data.meta}
            onPageChange={(page) => updateParams({ page: String(page) }, { resetPage: false })}
          />
        </>
      )}

      <RevokeInvitationDialog
        invitation={revoking}
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevoking(null);
          }
        }}
      />
    </div>
  );
}
