'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { BoardTaskStatus, TaskListItem } from '@nexo/types';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TASK_STATUS_LABELS } from '../labels';
import { STATUS_DOTS } from './task-badges';

type KanbanColumnProps = {
  status: BoardTaskStatus;
  tasks: TaskListItem[];
  /** Every matching task, which can exceed what the column shows. */
  total: number;
  onCreate?: () => void;
  children: ReactNode;
};

/** A column is itself a drop target, so an empty column still accepts a card. */
export function KanbanColumn({ status, tasks, total, onCreate, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const label = TASK_STATUS_LABELS[status];
  const headingId = `board-column-${status}`;

  return (
    <section
      aria-labelledby={headingId}
      className="bg-muted/40 border-border flex w-[min(20rem,85vw)] shrink-0 snap-start flex-col rounded-xl border sm:w-72 xl:w-auto xl:min-w-64 xl:flex-1"
    >
      <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <h2 id={headingId} className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <span
            className={cn('size-2 shrink-0 rounded-full', STATUS_DOTS[status])}
            aria-hidden="true"
          />
          <span className="truncate">{label}</span>
          <span className="text-muted-foreground font-normal tabular-nums">
            {total}
            <span className="sr-only"> {total === 1 ? 'tarea' : 'tareas'}</span>
          </span>
        </h2>
        {onCreate ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCreate}
            aria-label={`Nueva tarea en ${label}`}
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </header>

      <SortableContext
        id={status}
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          ref={setNodeRef}
          className={cn(
            'flex min-h-28 flex-1 flex-col gap-2 rounded-b-xl p-2 pt-0 transition-colors',
            isOver && 'bg-primary/5',
          )}
        >
          {children}
          {tasks.length === 0 ? (
            <li className="text-muted-foreground border-border flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-6 text-center text-xs">
              Sin tareas
            </li>
          ) : null}
        </ul>
      </SortableContext>

      {total > tasks.length ? (
        <p className="text-muted-foreground px-3 pb-3 text-xs">
          Se muestran {tasks.length} de {total}. Usa los filtros o la lista para ver el resto.
        </p>
      ) : null}
    </section>
  );
}
