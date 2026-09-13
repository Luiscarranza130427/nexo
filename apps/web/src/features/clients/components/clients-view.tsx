'use client';

import type {
  Client,
  ClientListQuery,
  ClientSortField,
  ClientStatus,
  ClientType,
  SortOrder,
} from '@nexo/types';
import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { PaginationControls } from '@/components/shared/pagination-controls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { can } from '@/features/auth/permissions';
import { errorMessage } from '@/lib/api/errors';
import { useClientsQuery } from '../hooks/use-clients';
import { ClientsTable } from './clients-table';
import { ClientsToolbar, type ClientsFilters } from './clients-toolbar';
import { DeleteClientDialog } from './delete-client-dialog';

const PAGE_SIZE = 10;

const SORT_FIELDS: readonly ClientSortField[] = ['name', 'createdAt', 'updatedAt'];
const STATUSES: readonly ClientStatus[] = ['ACTIVE', 'INACTIVE', 'PROSPECT'];
const TYPES: readonly ClientType[] = ['PERSON', 'COMPANY'];

/** Only accepts values the API understands, so a hand-edited URL cannot 400 the page. */
function readParam<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function ClientsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function ClientsView() {
  const { membership } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);

  const role = membership?.role;
  const canCreate = can(role, 'clients:create');
  const permissions = {
    canUpdate: can(role, 'clients:update'),
    canDelete: can(role, 'clients:delete'),
  };

  // The URL is the source of truth for the list state: filters survive a
  // reload, the back button works, and a filtered view can be shared.
  const query: ClientListQuery = useMemo(
    () => ({
      page: Math.max(1, Number(searchParams.get('page')) || 1),
      limit: PAGE_SIZE,
      search: searchParams.get('search') ?? '',
      status: readParam(searchParams.get('status'), STATUSES),
      type: readParam(searchParams.get('type'), TYPES),
      sortBy: readParam(searchParams.get('sortBy'), SORT_FIELDS) ?? 'createdAt',
      sortOrder: readParam<SortOrder>(searchParams.get('sortOrder'), ['asc', 'desc']) ?? 'desc',
    }),
    [searchParams],
  );

  const { data, isPending, isError, error } = useClientsQuery(query);

  const updateParams = useCallback(
    (changes: Record<string, string | undefined>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      // Any change to filters or sorting invalidates the current page number.
      if (resetPage) {
        params.delete('page');
      }

      const search = params.toString();

      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const filters: ClientsFilters = {
    search: query.search ?? '',
    status: query.status,
    type: query.type,
  };

  const handleSort = (field: ClientSortField) => {
    // Clicking the active column flips the direction; a new column starts descending.
    const nextOrder = query.sortBy === field && query.sortOrder === 'desc' ? 'asc' : 'desc';

    updateParams({ sortBy: field, sortOrder: nextOrder });
  };

  const hasFilters = Boolean(query.search || query.status || query.type);

  const header = (
    <PageHeader
      title="Clientes"
      description="Gestiona las personas y empresas con las que trabaja tu organización."
    />
  );

  if (isError) {
    return (
      <>
        {header}
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      {header}

      <div className="space-y-5">
        <ClientsToolbar
          filters={filters}
          canCreate={canCreate}
          onSearchChange={(search) => updateParams({ search })}
          onStatusChange={(status) => updateParams({ status })}
          onTypeChange={(type) => updateParams({ type })}
          onClear={() => updateParams({ search: undefined, status: undefined, type: undefined })}
        />

        {isPending ? (
          <ClientsSkeleton />
        ) : data.data.length === 0 ? (
          // Two different nothings: an empty database is not a fruitless search.
          hasFilters ? (
            <EmptyState
              icon={Users}
              title="No encontramos clientes con estos filtros."
              description="Prueba con otros términos o quita los filtros aplicados."
              action={
                <Button
                  variant="outline"
                  onClick={() =>
                    updateParams({ search: undefined, status: undefined, type: undefined })
                  }
                >
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No hay clientes todavía"
              description="Agrega tu primer cliente para comenzar a organizar tus proyectos."
              action={
                canCreate ? (
                  <Button asChild className="gap-2">
                    <Link href="/clients/new">
                      <Plus className="size-4" aria-hidden="true" />
                      Nuevo cliente
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <ClientsTable
              clients={data.data}
              sortBy={query.sortBy ?? 'createdAt'}
              sortOrder={query.sortOrder ?? 'desc'}
              onSort={handleSort}
              onDelete={setPendingDelete}
              permissions={permissions}
            />
            <PaginationControls
              label="Paginación de clientes"
              meta={data.meta}
              onPageChange={(page) => updateParams({ page: String(page) }, false)}
            />
          </>
        )}
      </div>

      <DeleteClientDialog
        client={pendingDelete}
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
      />
    </>
  );
}
