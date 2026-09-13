'use client';

import type { TaskDetail, TaskStatus } from '@nexo/types';
import { Pencil, SquareKanban, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { can, canChangeTask } from '@/features/auth/permissions';
import { formatCalendarDate } from '@/features/projects/labels';
import { formatDateTime } from '@/lib/format-date';
import { useTaskQuery, useUpdateTask } from '../hooks/use-tasks';
import { TASK_STATUSES, TASK_STATUS_LABELS, assigneeName } from '../labels';
import { taskErrorMessage } from '../task-errors';
import { TaskDueDate, TaskPriorityBadge, TaskStatusBadge } from './task-badges';

type TaskDetailSheetProps = {
  /** Kept after closing, so the content does not vanish while the sheet slides out. */
  taskId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit: (task: TaskDetail) => void;
  onDelete: (task: TaskDetail) => void;
  /** Off on the board itself, where the link would lead back to the same page. */
  showBoardLink?: boolean;
};

export function TaskDetailSheet({
  taskId,
  open,
  onClose,
  showBoardLink = true,
  ...actions
}: TaskDetailSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {taskId ? (
          <TaskDetailBody taskId={taskId} showBoardLink={showBoardLink} {...actions} />
        ) : (
          <SheetHeader>
            <SheetTitle>Tarea</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function TaskDetailBody({
  taskId,
  showBoardLink,
  onEdit,
  onDelete,
}: {
  taskId: string;
  showBoardLink: boolean;
  onEdit: (task: TaskDetail) => void;
  onDelete: (task: TaskDetail) => void;
}) {
  const { membership, user } = useAuth();
  const { data: task, isPending, isError, error } = useTaskQuery(taskId);
  const update = useUpdateTask();

  if (isPending) {
    return (
      <>
        <SheetHeader className="pr-12">
          <SheetTitle className="sr-only">Cargando tarea</SheetTitle>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-6 w-3/4" />
        </SheetHeader>
        <div className="space-y-4 px-4" aria-hidden="true">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <SheetHeader className="pr-12">
        <SheetTitle>Tarea no disponible</SheetTitle>
        <SheetDescription>{taskErrorMessage(error)}</SheetDescription>
      </SheetHeader>
    );
  }

  const role = membership?.role;
  const canChange = canChangeTask(role, user?.id, task);
  const canDelete = can(role, 'tasks:delete');
  const boardLink = showBoardLink && task.status !== 'CANCELLED';

  const changeStatus = (status: TaskStatus) => {
    update.mutate(
      { id: task.id, input: { status } },
      {
        onSuccess: () => toast.success(`Estado cambiado a «${TASK_STATUS_LABELS[status]}».`),
        onError: (cause) => toast.error(taskErrorMessage(cause)),
      },
    );
  };

  return (
    <>
      <SheetHeader className="gap-2 pr-12">
        <Link
          href={`/projects/${task.project.id}`}
          className="text-muted-foreground hover:text-primary w-fit text-xs transition-colors"
        >
          <span className="font-mono">{task.project.code}</span> · {task.project.name}
        </Link>
        <SheetTitle className="text-lg leading-snug break-words">{task.title}</SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            <TaskDueDate dueDate={task.dueDate} status={task.status} />
          </div>
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-4 pb-6">
        {canChange ? (
          <div>
            <Label htmlFor="task-detail-status" className="mb-2">
              Cambiar estado
            </Label>
            <Select
              value={task.status}
              onValueChange={(value) => changeStatus(value as TaskStatus)}
              disabled={update.isPending}
            >
              <SelectTrigger id="task-detail-status" className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {TASK_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-4">
          <Detail label="Responsable">
            {task.assignee ? (
              <span className="flex min-w-0 items-center gap-2">
                <PersonAvatar person={task.assignee} className="size-6" />
                <span className="truncate">{assigneeName(task.assignee)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Sin asignar</span>
            )}
          </Detail>
          <Detail label="Completada">
            {task.completedAt ? formatDateTime(task.completedAt) : '—'}
          </Detail>
          <Detail label="Inicio">
            {task.startDate ? formatCalendarDate(task.startDate) : '—'}
          </Detail>
          <Detail label="Vencimiento">
            {task.dueDate ? formatCalendarDate(task.dueDate) : '—'}
          </Detail>
        </dl>

        <Separator />

        <section className="space-y-2" aria-labelledby="task-detail-description">
          <h3 id="task-detail-description" className="text-sm font-medium">
            Descripción
          </h3>
          {task.description ? (
            <p className="text-sm leading-relaxed break-words whitespace-pre-line text-pretty">
              {task.description}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">Sin descripción.</p>
          )}
        </section>

        <p className="text-muted-foreground text-xs">
          Creada el {formatDateTime(task.createdAt)} · Actualizada el{' '}
          {formatDateTime(task.updatedAt)}
        </p>
      </div>

      {canChange || canDelete || boardLink ? (
        <SheetFooter className="border-border border-t sm:flex-row sm:flex-wrap">
          {canChange ? (
            <Button variant="outline" className="gap-2" onClick={() => onEdit(task)}>
              <Pencil className="size-4" aria-hidden="true" />
              Editar
            </Button>
          ) : null}
          {boardLink ? (
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/projects/${task.project.id}/board`}>
                <SquareKanban className="size-4" aria-hidden="true" />
                Ver en el tablero
              </Link>
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive gap-2 sm:ml-auto"
              onClick={() => onDelete(task)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Eliminar
            </Button>
          ) : null}
        </SheetFooter>
      ) : null}
    </>
  );
}
