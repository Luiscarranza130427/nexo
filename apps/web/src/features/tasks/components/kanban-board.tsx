'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { BoardTaskStatus, TaskBoard, TaskBoardQuery, TaskListItem } from '@nexo/types';
import { ArrowRight, Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  applyColumns,
  findTask,
  isColumnId,
  locate,
  moveToColumn,
  moveToEnd,
  neighboursOf,
  reorderInColumn,
  toColumns,
  type BoardColumns,
} from '../board-logic';
import { useMoveTask } from '../hooks/use-tasks';
import { BOARD_STATUSES, TASK_STATUS_LABELS } from '../labels';
import { taskKeys } from '../query-keys';
import { taskErrorMessage } from '../task-errors';
import { KanbanCard, TaskCardBody } from './kanban-card';
import { KanbanColumn } from './kanban-column';

/** Space picks a card up, which leaves Enter free to open it. */
const KEYBOARD_CODES = { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] };

const INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'Pulsa Espacio para tomar la tarea. Usa las flechas para moverla dentro de la columna o a otra columna, y Espacio o Enter para soltarla. Escape cancela el movimiento. Enter, sin tomarla, abre el detalle.',
};

type KanbanBoardProps = {
  board: TaskBoard;
  query: TaskBoardQuery;
  canMove: (task: TaskListItem) => boolean;
  canCreate: boolean;
  canDelete: boolean;
  onCreate: (status: BoardTaskStatus) => void;
  onOpen: (task: TaskListItem) => void;
  onEdit: (task: TaskListItem) => void;
  onDelete: (task: TaskListItem) => void;
};

/** The arrangement on screen while dragging, and the board it was based on. */
type Draft = { base: TaskBoard; columns: BoardColumns };

/** Whether the dragged card's middle has passed the middle of the card it is over. */
function isBelow(active: Active, over: Over): boolean {
  const rect = active.rect.current.translated;

  return Boolean(rect && rect.top + rect.height / 2 > over.rect.top + over.rect.height / 2);
}

export function KanbanBoard({
  board,
  query,
  canMove,
  canCreate,
  canDelete,
  onCreate,
  onOpen,
  onEdit,
  onDelete,
}: KanbanBoardProps) {
  const move = useMoveTask();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const justDropped = useRef(false);

  // After a drop, the dropped arrangement stays on screen until the board data
  // itself changes — the optimistic update, or a rollback — so a card never
  // flashes back to where it came from.
  if (draft && activeId === null && draft.base !== board) {
    setDraft(null);
  }

  const serverColumns = useMemo(() => toColumns(board), [board]);
  const columns = draft?.columns ?? serverColumns;
  const activeTask = activeId ? findTask(columns, activeId) : null;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // A long press, so a swipe still scrolls the board sideways.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: KEYBOARD_CODES,
    }),
  );

  const titleOf = (id: UniqueIdentifier) => `«${findTask(columns, String(id))?.title ?? 'tarea'}»`;

  const placeOf = (id: UniqueIdentifier) => {
    const key = String(id);

    if (isColumnId(key)) {
      return `la columna ${TASK_STATUS_LABELS[key]}`;
    }

    const place = locate(columns, key);

    return place
      ? `${TASK_STATUS_LABELS[place.status]}, posición ${place.index + 1} de ${columns[place.status].length}`
      : 'el tablero';
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Has tomado la tarea ${titleOf(active.id)}, en ${placeOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `La tarea ${titleOf(active.id)} está sobre ${placeOf(over.id)}.`
        : `La tarea ${titleOf(active.id)} no está sobre ninguna columna.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Has soltado la tarea ${titleOf(active.id)} en ${placeOf(over.id)}.`
        : `Has soltado la tarea ${titleOf(active.id)} fuera del tablero. No se ha movido.`,
    onDragCancel: ({ active }) =>
      `Movimiento cancelado. La tarea ${titleOf(active.id)} vuelve a su sitio.`,
  };

  /** Shows the new arrangement at once and asks the API to confirm it. */
  const commit = (taskId: string, arranged: BoardColumns) => {
    const place = locate(arranged, taskId);
    const task = findTask(arranged, taskId);

    if (!place || !task) {
      setDraft(null);

      return;
    }

    setDraft({ base: board, columns: arranged });
    move.mutate(
      {
        taskId,
        projectId: task.project.id,
        input: { status: place.status, ...neighboursOf(arranged[place.status], taskId) },
        board: { key: taskKeys.board(query), next: applyColumns(board, arranged) },
      },
      { onError: (error) => toast.error(taskErrorMessage(error)) },
    );
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setDraft({ base: board, columns });
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) {
      return;
    }

    const below = isBelow(active, over);

    setDraft((current) => {
      if (!current) {
        return current;
      }

      const next = moveToColumn(current.columns, String(active.id), String(over.id), below);

      return next === current.columns ? current : { ...current, columns: next };
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const taskId = String(active.id);
    const arranged = draft && over ? reorderInColumn(draft.columns, taskId, String(over.id)) : null;

    setActiveId(null);

    // The click that ends a mouse drag must not also open the card.
    justDropped.current = true;
    setTimeout(() => {
      justDropped.current = false;
    }, 0);

    const origin = locate(serverColumns, taskId);
    const target = arranged ? locate(arranged, taskId) : null;

    if (
      !arranged ||
      !origin ||
      !target ||
      (origin.status === target.status && origin.index === target.index)
    ) {
      setDraft(null);

      return;
    }

    commit(taskId, arranged);
  };

  /** The menu's "Mover a": no dragging, straight to the end of the column. */
  const moveTo = (task: TaskListItem, status: BoardTaskStatus) => {
    commit(task.id, moveToEnd(columns, task.id, status));
  };

  const openTask = (task: TaskListItem) => {
    if (!justDropped.current) {
      onOpen(task);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements, screenReaderInstructions: INSTRUCTIONS }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDraft(null);
      }}
    >
      {/* Scrolls sideways inside itself; the page never scrolls horizontally. */}
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 sm:snap-none">
        {BOARD_STATUSES.map((status) => {
          const column = board.columns.find((candidate) => candidate.status === status);
          const tasks = columns[status];
          // While a card is on its way, the count follows the cards.
          const total = (column?.total ?? 0) + tasks.length - (column?.tasks.length ?? 0);

          return (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasks}
              total={total}
              onCreate={canCreate ? () => onCreate(status) : undefined}
            >
              {tasks.map((task) => {
                const movable = canMove(task);

                return (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    canMove={movable}
                    onOpen={openTask}
                    actions={
                      <CardActions
                        task={task}
                        status={status}
                        canMove={movable}
                        canDelete={canDelete}
                        onOpen={onOpen}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onMove={moveTo}
                      />
                    }
                  />
                );
              })}
            </KanbanColumn>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="bg-card border-primary/40 cursor-grabbing rounded-lg border p-3 pr-10 shadow-lg">
            <TaskCardBody task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Everything a card offers, including a way to move it without dragging. */
function CardActions({
  task,
  status,
  canMove,
  canDelete,
  onOpen,
  onEdit,
  onDelete,
  onMove,
}: {
  task: TaskListItem;
  status: BoardTaskStatus;
  canMove: boolean;
  canDelete: boolean;
  onOpen: (task: TaskListItem) => void;
  onEdit: (task: TaskListItem) => void;
  onDelete: (task: TaskListItem) => void;
  onMove: (task: TaskListItem, status: BoardTaskStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Acciones para ${task.title}`}
          className="text-muted-foreground"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => onOpen(task)} className="gap-2">
          <Eye className="size-4" aria-hidden="true" />
          Ver detalle
        </DropdownMenuItem>
        {canMove ? (
          <>
            <DropdownMenuItem onSelect={() => onEdit(task)} className="gap-2">
              <Pencil className="size-4" aria-hidden="true" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Mover a
            </DropdownMenuLabel>
            {BOARD_STATUSES.filter((candidate) => candidate !== status).map((candidate) => (
              <DropdownMenuItem
                key={candidate}
                onSelect={() => onMove(task, candidate)}
                className="gap-2"
              >
                <ArrowRight className="size-4" aria-hidden="true" />
                {TASK_STATUS_LABELS[candidate]}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
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
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
