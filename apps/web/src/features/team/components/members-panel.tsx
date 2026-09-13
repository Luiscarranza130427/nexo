'use client';

import type {
  MembershipRole,
  SortOrder,
  TeamListQuery,
  TeamMember,
  TeamSortField,
  UserStatus,
} from '@nexo/types';
import { Users } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { PaginationControls } from '@/components/shared/pagination-controls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { useUpdateSearchParams } from '@/hooks/use-update-search-params';
import { errorMessage } from '@/lib/api/errors';
import { useTeamQuery } from '../hooks/use-team';
import { MEMBERSHIP_ROLES, USER_STATUSES } from '../labels';
import { ChangeRoleDialog } from './change-role-dialog';
import { RemoveMemberDialog } from './remove-member-dialog';
import { TeamTable } from './team-table';
import { TeamToolbar, type TeamFilterKey } from './team-toolbar';

const PAGE_SIZE = 20;

const SORT_FIELDS: readonly TeamSortField[] = ['name', 'email', 'role', 'joinedAt'];

/** Only accepts values the API understands, so a hand-edited URL cannot 400 the page. */
function readParam<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function MembersPanel() {
  const { membership, user } = useAuth();
  const searchParams = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const [changing, setChanging] = useState<{ member: TeamMember | null; open: boolean }>({
    member: null,
    open: false,
  });
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  // The URL is the source of truth: filters survive a reload and can be shared.
  const query: TeamListQuery = useMemo(
    () => ({
      page: Math.max(1, Number(searchParams.get('page')) || 1),
      limit: PAGE_SIZE,
      search: searchParams.get('search') ?? '',
      role: readParam<MembershipRole>(searchParams.get('role'), MEMBERSHIP_ROLES),
      status: readParam<UserStatus>(searchParams.get('status'), USER_STATUSES),
      sortBy: readParam(searchParams.get('sortBy'), SORT_FIELDS) ?? 'name',
      sortOrder: readParam<SortOrder>(searchParams.get('sortOrder'), ['asc', 'desc']) ?? 'asc',
    }),
    [searchParams],
  );

  const { data, isPending, isError, error } = useTeamQuery(query);

  const handleFilterChange = useCallback(
    (key: TeamFilterKey, value: string | undefined) => updateParams({ [key]: value }),
    [updateParams],
  );

  const clearFilters = () =>
    updateParams({ search: undefined, role: undefined, status: undefined });
  const hasFilters = Boolean(query.search || query.role || query.status);

  return (
    <div className="space-y-5">
      <TeamToolbar
        values={{ search: query.search ?? '', role: query.role, status: query.status }}
        sort={`${query.sortBy}:${query.sortOrder}`}
        onChange={handleFilterChange}
        onSortChange={(value) => {
          const [sortBy, sortOrder] = value.split(':');

          updateParams({ sortBy, sortOrder });
        }}
        onClear={clearFilters}
      />

      {isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      ) : isPending ? (
        <div className="space-y-3" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : data.data.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Users}
            title="No encontramos miembros con estos filtros."
            description="Prueba con otros términos o quita los filtros aplicados."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          // An organization always keeps an owner; this only guards against the unexpected.
          <EmptyState
            icon={Users}
            title="No hay miembros que mostrar"
            description="Recarga la página. Si persiste, contacta con un administrador."
          />
        )
      ) : (
        <>
          <TeamTable
            members={data.data}
            actorRole={membership?.role}
            currentUserId={user?.id}
            onChangeRole={(member) => setChanging({ member, open: true })}
            onRemove={setRemoving}
          />
          <PaginationControls
            label="Paginación del equipo"
            meta={data.meta}
            onPageChange={(page) => updateParams({ page: String(page) }, { resetPage: false })}
          />
        </>
      )}

      <ChangeRoleDialog
        member={changing.member}
        open={changing.open}
        onOpenChange={(open) => setChanging((current) => ({ ...current, open }))}
      />

      <RemoveMemberDialog
        member={removing}
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
      />
    </div>
  );
}
