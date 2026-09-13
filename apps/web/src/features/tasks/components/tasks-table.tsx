'use client';

import type { TaskListItem } from '@nexo/types';
import { Eye, MoreHorizontal, Pencil, SquareKanban, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCalendarDate } from '@/features/projects/labels';
import { assigneeName } from '../labels';
import { TaskDueDate, TaskPriorityBadge, TaskStatusBadge } from './task-badges';

type TaskHandlers = {
  onOpen: (task: TaskListItem) => void;
  onEdit: (task: TaskListItem) => void;
  onDelete: (task: TaskListItem) => void;
};

type TasksTableProps = TaskHandlers & {
  tasks: TaskListItem[];
  /** Per task: a MEMBER may only change the tasks assigned to them. */
  canChange: (task: TaskListItem) => boolean;
  canDelete: boolean;
};

/** Filtered by role and by task. Everyone can at least open the detail. */
function RowActions({
  task,
  canChange,
  canDelete,
  onOpen,
  onEdit,
  onDelete,
}: TaskHandlers & { task: TaskListItem; canChange: boolean; canDelete: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Acciones para ${task.title}`}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => onOpen(task)} className="gap-2">
          <Eye className="size-4" aria-hidden="true" />
          Ver detalle
        </DropdownMenuItem>
        {canChange ? (
          <DropdownMenuItem onSelect={() => onEdit(task)} className="gap-2">
            <Pencil className="size-4" aria-hidden="true" />
            Editar
          </DropdownMenuItem>
        ) : null}
        {task.status !== 'CANCELLED' ? (
          <DropdownMenuItem asChild>
            <Link href={`/projects/${task.project.id}/board`} className="gap-2">
              <SquareKanban className="size-4" aria-hidden="true" />
              Abrir tablero
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onDelete(task);
            }}
            className="text-destructive focus:text-destructive gap-2"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Eliminar
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectLink({ task }: { task: TaskListItem }) {
  return (
    <Link
      href={`/projects/${task.project.id}`}
      className="text-muted-foreground hover:text-primary flex min-w-0 items-center gap-1.5 text-xs transition-colors"
    >
      <span className="font-mono">{task.project.code}</span>
      <span className="truncate">{task.project.name}</span>
    </Link>
  );
}

function Assignee({ task }: { task: TaskListItem }) {
  if (!task.assignee) {
    return <span className="text-muted-foreground text-sm">Sin asignar</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <PersonAvatar person={task.assignee} className="size-6" />
      <span className="truncate text-sm">{assigneeName(task.assignee)}</span>
    </span>
  );
}

function TitleButton({ task, onOpen }: { task: TaskListItem; onOpen: TaskHandlers['onOpen'] }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="hover:text-primary focus-visible:ring-ring/50 block max-w-full rounded-sm text-left font-medium transition-colors outline-none focus-visible:ring-[3px]"
    >
      <span className="line-clamp-2 break-words">{task.title}</span>
    </button>
  );
}

export function TasksTable({ tasks, canChange, canDelete, ...handlers }: TasksTableProps) {
  return (
    <>
      {/* Desktop: a real table, with semantics assistive technology understands. */}
      <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarea</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead className="hidden lg:table-cell">Responsable</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="max-w-80 space-y-1 whitespace-normal">
                  <TitleButton task={task} onOpen={handlers.onOpen} />
                  <ProjectLink task={task} />
                </TableCell>
                <TableCell>
                  <TaskStatusBadge status={task.status} />
                </TableCell>
                <TableCell>
                  <TaskPriorityBadge priority={task.priority} />
                </TableCell>
                <TableCell className="hidden max-w-48 lg:table-cell">
                  <Assignee task={task} />
                </TableCell>
                <TableCell>
                  {task.dueDate ? (
                    <div className="flex flex-col gap-0.5 text-sm whitespace-nowrap">
                      <span>{formatCalendarDate(task.dueDate)}</span>
                      <TaskDueDate dueDate={task.dueDate} status={task.status} />
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <RowActions
                    task={task}
                    canChange={canChange(task)}
                    canDelete={canDelete}
                    {...handlers}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: compact cards instead of a table squeezed sideways. Works from 320px. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {tasks.map((task) => (
          <li key={task.id} className="border-border bg-card rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <ProjectLink task={task} />
                <TitleButton task={task} onOpen={handlers.onOpen} />
                <div className="flex flex-wrap items-center gap-2">
                  <TaskStatusBadge status={task.status} />
                  <TaskPriorityBadge priority={task.priority} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Assignee task={task} />
                  {task.dueDate ? (
                    <span className="text-muted-foreground text-xs">
                      Vence el {formatCalendarDate(task.dueDate)}
                    </span>
                  ) : null}
                  <TaskDueDate dueDate={task.dueDate} status={task.status} />
                </div>
              </div>

              <RowActions
                task={task}
                canChange={canChange(task)}
                canDelete={canDelete}
                {...handlers}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
