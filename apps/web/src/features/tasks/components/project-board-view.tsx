'use client';

import type { Priority, TaskBoardQuery } from '@nexo/types';
import { ArrowLeft, List, Plus, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { can, canChangeTask } from '@/features/auth/permissions';
import { ProjectStatusBadge } from '@/features/projects/components/project-badges';
import { ProjectNotFound } from '@/features/projects/components/project-views';
import { useProjectMembersQuery, useProjectQuery } from '@/features/projects/hooks/use-projects';
import { PRIORITIES } from '@/features/projects/labels';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { useTaskBoardQuery } from '../hooks/use-tasks';
import { KanbanBoard } from './kanban-board';
import { TaskDialogs, useTaskDialogs } from './task-dialogs';
import { TaskFilters, type TaskFilterKey } from './task-filters';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-96 w-72 shrink-0 rounded-xl" />
      ))}
    </div>
  );
}

export function ProjectBoardView({ projectId }: { projectId: string }) {
  const { membership, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dialogs = useTaskDialogs();

  const role = membership?.role;
  const canCreate = can(role, 'tasks:create');
  const canDelete = can(role, 'tasks:delete');

  // Loading the project also names the breadcrumb, which reads its detail cache.
  const project = useProjectQuery(projectId);
  const members = useProjectMembersQuery(projectId, project.isSuccess);

  // Filters live in the URL, like everywhere else: a filtered board can be shared.
  const query: TaskBoardQuery = useMemo(() => {
    const priority = searchParams.get('priority');
    const assigneeId = searchParams.get('assigneeId');

    return {
      projectId,
      search: searchParams.get('search') ?? '',
      priority:
        priority && (PRIORITIES as string[]).includes(priority)
          ? (priority as Priority)
          : undefined,
      assigneeId: assigneeId && UUID.test(assigneeId) ? assigneeId : undefined,
    };
  }, [projectId, searchParams]);

  const board = useTaskBoardQuery(query, project.isSuccess);

  const updateParams = useCallback(
    (changes: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
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

  if (project.isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-2/3 max-w-md" />
        <BoardSkeleton />
      </div>
    );
  }

  if (project.isError) {
    return <ProjectNotFound error={project.error} />;
  }

  // A MEMBER only sees the boards of projects they belong to.
  const notAMember = board.error instanceof ApiError && board.error.status === 403;
  const hasFilters = Boolean(query.search || query.priority || query.assigneeId);

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Link
            href={`/projects/${projectId}`}
            className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="font-mono">{project.data.code}</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">
            {project.data.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.data.status} />
            <span className="text-muted-foreground text-sm">Tablero de tareas</span>
          </div>
        </div>

        <Button asChild variant="outline" className="shrink-0 gap-2">
          <Link href={`/tasks?projectId=${projectId}`}>
            <List className="size-4" aria-hidden="true" />
            Ver como lista
          </Link>
        </Button>
      </header>

      {notAMember ? (
        <EmptyState
          icon={ShieldAlert}
          title="No participas en este proyecto"
          description="Solo los miembros del proyecto ven su tablero. Pide a un gestor que te añada."
          action={
            <Button asChild variant="outline">
              <Link href={`/projects/${projectId}`}>Volver al proyecto</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <TaskFilters
            values={{
              search: query.search ?? '',
              priority: query.priority,
              assigneeId: query.assigneeId,
            }}
            onChange={handleFilterChange}
            onClear={() =>
              updateParams({ search: undefined, priority: undefined, assigneeId: undefined })
            }
            people={members.data ?? []}
            currentUserId={user?.id}
            searchPlaceholder="Buscar en el tablero"
            actions={
              canCreate ? (
                <Button
                  className="flex-1 gap-2 sm:flex-none"
                  onClick={() => dialogs.openCreate({ projectId })}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Nueva tarea
                </Button>
              ) : null
            }
          />

          {board.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(board.error)}</AlertDescription>
            </Alert>
          ) : board.isPending ? (
            <BoardSkeleton />
          ) : (
            <>
              {hasFilters ? (
                <p className="text-muted-foreground text-sm" role="status">
                  Solo se muestran las tareas que coinciden con los filtros.
                </p>
              ) : null}
              <KanbanBoard
                board={board.data}
                query={query}
                canMove={(task) => canChangeTask(role, user?.id, task)}
                canCreate={canCreate}
                canDelete={canDelete}
                onCreate={(status) => dialogs.openCreate({ projectId, defaultStatus: status })}
                onOpen={(task) => dialogs.openDetail(task.id)}
                onEdit={(task) => void dialogs.editById(task.id)}
                onDelete={dialogs.openDelete}
              />
            </>
          )}

          <p className="text-muted-foreground text-xs">
            Las tareas canceladas no aparecen en el tablero. Encuéntralas en la{' '}
            <Link
              href={`/tasks?projectId=${projectId}&status=CANCELLED`}
              className="hover:text-primary underline underline-offset-4"
            >
              lista de tareas
            </Link>
            .
          </p>
        </div>
      )}

      <TaskDialogs state={dialogs} showBoardLink={false} />
    </>
  );
}
