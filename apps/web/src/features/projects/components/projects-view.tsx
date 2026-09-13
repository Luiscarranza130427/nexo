'use client';

import type {
  Priority,
  ProjectListItem,
  ProjectListQuery,
  ProjectSortField,
  ProjectStatus,
  SortOrder,
} from '@nexo/types';
import { FolderKanban, Plus } from 'lucide-react';
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
import { useProjectsQuery } from '../hooks/use-projects';
import { PRIORITIES, PROJECT_STATUSES } from '../labels';
import { ProjectDeleteDialog } from './project-delete-dialog';
import { ProjectMembersDialog } from './project-members-dialog';
import { ProjectsTable } from './projects-table';
import { ProjectsToolbar, type ProjectsFilters } from './projects-toolbar';

const PAGE_SIZE = 10;

const SORT_FIELDS: readonly ProjectSortField[] = [
  'name',
  'code',
  'createdAt',
  'updatedAt',
  'startDate',
  'dueDate',
  'priority',
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only accepts values the API understands, so a hand-edited URL cannot 400 the page. */
function readParam<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

const HEADER = (
  <PageHeader
    title="Proyectos"
    description="Gestiona los proyectos, responsables, clientes y fechas de tu organización."
  />
);

export function ProjectsView() {
  const { membership } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingDelete, setPendingDelete] = useState<ProjectListItem | null>(null);
  const [managingMembers, setManagingMembers] = useState<ProjectListItem | null>(null);

  const role = membership?.role;
  const canCreate = can(role, 'projects:create');
  const permissions = {
    canUpdate: can(role, 'projects:update'),
    canDelete: can(role, 'projects:delete'),
    canManageMembers: can(role, 'projects:members'),
  };

  // The URL is the source of truth: filters survive a reload, the back button
  // works and a filtered view can be shared.
  const query: ProjectListQuery = useMemo(() => {
    const clientId = searchParams.get('clientId');

    return {
      page: Math.max(1, Number(searchParams.get('page')) || 1),
      limit: PAGE_SIZE,
      search: searchParams.get('search') ?? '',
      status: readParam<ProjectStatus>(searchParams.get('status'), PROJECT_STATUSES),
      priority: readParam<Priority>(searchParams.get('priority'), PRIORITIES),
      clientId: clientId && UUID.test(clientId) ? clientId : undefined,
      sortBy: readParam(searchParams.get('sortBy'), SORT_FIELDS) ?? 'createdAt',
      sortOrder: readParam<SortOrder>(searchParams.get('sortOrder'), ['asc', 'desc']) ?? 'desc',
    };
  }, [searchParams]);

  const { data, isPending, isError, error } = useProjectsQuery(query);

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

      // A different filter or order makes the current page number meaningless.
      if (resetPage) {
        params.delete('page');
      }

      const search = params.toString();

      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const filters: ProjectsFilters = {
    search: query.search ?? '',
    status: query.status,
    priority: query.priority,
    clientId: query.clientId,
  };

  const clearFilters = () =>
    updateParams({
      search: undefined,
      status: undefined,
      priority: undefined,
      clientId: undefined,
    });

  const hasFilters = Boolean(query.search || query.status || query.priority || query.clientId);

  if (isError) {
    return (
      <>
        {HEADER}
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      {HEADER}

      <div className="space-y-5">
        <ProjectsToolbar
          filters={filters}
          sort={`${query.sortBy}:${query.sortOrder}`}
          canCreate={canCreate}
          onSearchChange={(search) => updateParams({ search })}
          onStatusChange={(status) => updateParams({ status })}
          onPriorityChange={(priority) => updateParams({ priority })}
          onClientChange={(clientId) => updateParams({ clientId })}
          onSortChange={(sort) => {
            const [sortBy, sortOrder] = sort.split(':');

            updateParams({ sortBy, sortOrder });
          }}
          onClear={clearFilters}
        />

        {isPending ? (
          <ProjectsSkeleton />
        ) : data.data.length === 0 ? (
          // An empty organization and a fruitless search are different situations.
          hasFilters ? (
            <EmptyState
              icon={FolderKanban}
              title="No encontramos proyectos con estos filtros."
              description="Prueba con otros términos o quita los filtros aplicados."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="No hay proyectos todavía"
              description="Crea el primer proyecto de tu organización."
              action={
                canCreate ? (
                  <Button asChild className="gap-2">
                    <Link href="/projects/new">
                      <Plus className="size-4" aria-hidden="true" />
                      Nuevo proyecto
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <ProjectsTable
              projects={data.data}
              permissions={permissions}
              onManageMembers={setManagingMembers}
              onDelete={setPendingDelete}
            />
            <PaginationControls
              label="Paginación de proyectos"
              meta={data.meta}
              onPageChange={(page) => updateParams({ page: String(page) }, false)}
            />
          </>
        )}
      </div>

      <ProjectDeleteDialog
        project={pendingDelete}
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
      />

      {managingMembers ? (
        <ProjectMembersDialog
          projectId={managingMembers.id}
          projectName={`${managingMembers.code} · ${managingMembers.name}`}
          open
          canManage={permissions.canManageMembers}
          onOpenChange={(open) => {
            if (!open) {
              setManagingMembers(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
