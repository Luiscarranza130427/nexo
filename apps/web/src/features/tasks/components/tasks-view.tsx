'use client';

import type { Priority, SortOrder, TaskListQuery, TaskSortField, TaskStatus } from '@nexo/types';
import { FolderKanban, ListChecks, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { PaginationControls } from '@/components/shared/pagination-controls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { can, canChangeTask } from '@/features/auth/permissions';
import {
  useOrganizationMembersQuery,
  useProjectsQuery,
} from '@/features/projects/hooks/use-projects';
import { PRIORITIES } from '@/features/projects/labels';
import { isCalendarDate } from '@/features/projects/schemas/project-schema';
import { errorMessage } from '@/lib/api/errors';
import { useTasksQuery } from '../hooks/use-tasks';
import { TASK_STATUSES } from '../labels';
import { TaskDialogs, useTaskDialogs } from './task-dialogs';
import { TaskFilters, type TaskFilterKey } from './task-filters';
import { TasksTable } from './tasks-table';

const PAGE_SIZE = 20;

const SORT_FIELDS: readonly TaskSortField[] = [
  'position',
  'title',
  'priority',
  'createdAt',
  'updatedAt',
  'startDate',
  'dueDate',
];

const FILTER_KEYS: TaskFilterKey[] = [
  'search',
  'projectId',
  'status',
  'priority',
  'assigneeId',
  'dueFrom',
  'dueTo',
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only accepts values the API understands, so a hand-edited URL cannot 400 the page. */
function readParam<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

const readUuid = (value: string | null) => (value && UUID.test(value) ? value : undefined);

const readDate = (value: string | null) => (value && isCalendarDate(value) ? value : undefined);

function TasksSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function TasksView() {
  const { membership, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dialogs = useTaskDialogs();

  const role = membership?.role;
  const canCreate = can(role, 'tasks:create');
  const canDelete = can(role, 'tasks:delete');

  // The URL is the source of truth: filters survive a reload, the back button
  // works and a filtered view can be shared.
  const query: TaskListQuery = useMemo(() => {
    const dueFrom = readDate(searchParams.get('dueFrom'));
    const dueTo = readDate(searchParams.get('dueTo'));

    return {
      page: Math.max(1, Number(searchParams.get('page')) || 1),
      limit: PAGE_SIZE,
      search: searchParams.get('search') ?? '',
      projectId: readUuid(searchParams.get('projectId')),
      status: readParam<TaskStatus>(searchParams.get('status'), TASK_STATUSES),
      priority: readParam<Priority>(searchParams.get('priority'), PRIORITIES),
      assigneeId: readUuid(searchParams.get('assigneeId')),
      dueFrom,
      // An inverted range would be a 400; drop its end rather than break the page.
      dueTo: dueTo && (!dueFrom || dueTo >= dueFrom) ? dueTo : undefined,
      sortBy: readParam(searchParams.get('sortBy'), SORT_FIELDS) ?? 'createdAt',
      sortOrder: readParam<SortOrder>(searchParams.get('sortOrder'), ['asc', 'desc']) ?? 'desc',
    };
  }, [searchParams]);

  const tasks = useTasksQuery(query);
  const projects = useProjectsQuery({ limit: 100, sortBy: 'code', sortOrder: 'asc' });
  const people = useOrganizationMembersQuery(true);

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

  const handleFilterChange = useCallback(
    (key: TaskFilterKey, value: string | undefined) => updateParams({ [key]: value }),
    [updateParams],
  );

  const clearFilters = () =>
    updateParams(Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])));

  const hasFilters = FILTER_KEYS.some((key) => Boolean(query[key]));

  const header = (
    <PageHeader
      title="Tareas"
      description={
        role === 'MEMBER'
          ? 'Las tareas de los proyectos en los que participas.'
          : 'Todas las tareas de la organización, con sus responsables, estados y vencimientos.'
      }
    />
  );

  if (tasks.isError) {
    return (
      <>
        {header}
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(tasks.error)}</AlertDescription>
        </Alert>
      </>
    );
  }

  // Tasks live inside projects: without one there is nothing to create a task in.
  const noProjects = projects.data?.meta.total === 0;

  const newTaskButton =
    canCreate && !noProjects ? (
      <Button
        className="flex-1 gap-2 sm:flex-none"
        onClick={() => dialogs.openCreate({ defaultProjectId: query.projectId })}
      >
        <Plus className="size-4" aria-hidden="true" />
        Nueva tarea
      </Button>
    ) : null;

  return (
    <>
      {header}

      <div className="space-y-5">
        <TaskFilters
          values={{
            search: query.search ?? '',
            projectId: query.projectId,
            status: query.status,
            priority: query.priority,
            assigneeId: query.assigneeId,
            dueFrom: query.dueFrom,
            dueTo: query.dueTo,
          }}
          onChange={handleFilterChange}
          onClear={clearFilters}
          people={people.data ?? []}
          currentUserId={user?.id}
          projects={projects.data?.data ?? []}
          withStatus
          withDueRange
          sort={{
            value: `${query.sortBy}:${query.sortOrder}`,
            onChange: (value) => {
              const [sortBy, sortOrder] = value.split(':');

              updateParams({ sortBy, sortOrder });
            },
          }}
          searchPlaceholder="Buscar por título o descripción"
          actions={newTaskButton}
        />

        {tasks.isPending ? (
          <TasksSkeleton />
        ) : tasks.data.data.length === 0 ? (
          // An empty organization and a fruitless search are different situations.
          hasFilters ? (
            <EmptyState
              icon={ListChecks}
              title="No encontramos tareas con estos filtros."
              description="Prueba con otros términos o quita los filtros aplicados."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : noProjects ? (
            <EmptyState
              icon={FolderKanban}
              title="Todavía no hay proyectos"
              description="Las tareas viven dentro de un proyecto. Crea uno para empezar a organizar el trabajo."
              action={
                can(role, 'projects:create') ? (
                  <Button asChild className="gap-2">
                    <Link href="/projects/new">
                      <Plus className="size-4" aria-hidden="true" />
                      Nuevo proyecto
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              icon={ListChecks}
              title="No hay tareas todavía"
              description={
                canCreate
                  ? 'Crea la primera tarea aquí o desde el tablero de un proyecto.'
                  : 'Cuando te asignen tareas en tus proyectos, aparecerán aquí.'
              }
              action={newTaskButton ?? undefined}
            />
          )
        ) : (
          <>
            <TasksTable
              tasks={tasks.data.data}
              canChange={(task) => canChangeTask(role, user?.id, task)}
              canDelete={canDelete}
              onOpen={(task) => dialogs.openDetail(task.id)}
              onEdit={(task) => void dialogs.editById(task.id)}
              onDelete={dialogs.openDelete}
            />
            <PaginationControls
              label="Paginación de tareas"
              meta={tasks.data.meta}
              onPageChange={(page) => updateParams({ page: String(page) }, false)}
            />
          </>
        )}
      </div>

      <TaskDialogs state={dialogs} />
    </>
  );
}
