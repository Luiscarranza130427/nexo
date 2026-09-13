'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TaskListItem } from '@nexo/types';
import { CalendarDays } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { formatCalendarDate } from '@/features/projects/labels';
import { cn } from '@/lib/utils';
import { assigneeName } from '../labels';
import { TaskDueDate, TaskPriorityBadge } from './task-badges';

/** What a card shows. Also rendered, unchanged, inside the drag overlay. */
export function TaskCardBody({ task }: { task: TaskListItem }) {
  return (
    <div className="space-y-2.5">
      <p className="line-clamp-3 text-sm leading-snug font-medium break-words">{task.title}</p>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <TaskPriorityBadge priority={task.priority} />
        {task.dueDate ? (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Vence el </span>
            {formatCalendarDate(task.dueDate)}
          </span>
        ) : null}
      </div>

      <div className="flex min-h-5 items-center justify-between gap-2">
        {task.assignee ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <PersonAvatar person={task.assignee} className="size-5 text-[0.6rem]" />
            <span className="truncate text-xs">{assigneeName(task.assignee)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">Sin asignar</span>
        )}
        <TaskDueDate dueDate={task.dueDate} status={task.status} className="shrink-0" />
      </div>
    </div>
  );
}

type KanbanCardProps = {
  task: TaskListItem;
  /** False for a MEMBER looking at someone else's task: it still opens, but does not move. */
  canMove: boolean;
  onOpen: (task: TaskListItem) => void;
  actions?: ReactNode;
};

/**
 * A task on the board. The card itself is the drag handle: a short mouse drag,
 * a long press on touch, or Space on the keyboard picks it up, while a plain
 * click or Enter opens the detail. The actions menu sits beside the handle,
 * never inside it, so no control is nested in another.
 */
export function KanbanCard({ task, canMove, onOpen, actions }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    // A card that cannot move is still a place other cards can be dropped next to.
    disabled: { draggable: !canMove, droppable: false },
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(event);

    // Enter also ends a keyboard drag; only open the card when nothing is being dragged.
    if (event.key === 'Enter' && !isDragging) {
      event.preventDefault();
      onOpen(task);
    }
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative', isDragging && 'opacity-40')}
    >
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-roledescription={canMove ? 'tarea movible' : undefined}
        aria-describedby={canMove ? attributes['aria-describedby'] : undefined}
        aria-disabled={undefined}
        onKeyDown={handleKeyDown}
        onClick={() => onOpen(task)}
        className={cn(
          'bg-card border-border hover:border-primary/40 focus-visible:border-ring focus-visible:ring-ring/50 block w-full rounded-lg border p-3 pr-10 text-left shadow-xs transition-colors outline-none focus-visible:ring-[3px]',
          canMove ? 'cursor-grab touch-manipulation active:cursor-grabbing' : 'cursor-pointer',
        )}
      >
        <TaskCardBody task={task} />
      </div>
      {actions ? <div className="absolute top-2 right-2">{actions}</div> : null}
    </li>
  );
}
