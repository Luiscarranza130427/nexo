import type { BoardTaskStatus, TaskBoard, TaskListItem } from '@nexo/types';
import { BOARD_STATUSES } from './labels';

/**
 * Pure board rearrangements, shared by drag and drop and by the "Mover a" menu.
 * No React and no dnd-kit here, so every move is testable on its own.
 */

/** A board's visible tasks by column — the shape a drag rearranges. */
export type BoardColumns = Record<BoardTaskStatus, TaskListItem[]>;

export type BoardPlace = { status: BoardTaskStatus; index: number };

export function toColumns(board: TaskBoard): BoardColumns {
  const columns: BoardColumns = { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] };

  for (const column of board.columns) {
    columns[column.status] = column.tasks;
  }

  return columns;
}

export function isColumnId(id: string): id is BoardTaskStatus {
  return (BOARD_STATUSES as string[]).includes(id);
}

/** The column an id belongs to: a column's own status, or the column holding that task. */
export function columnOf(columns: BoardColumns, id: string): BoardTaskStatus | null {
  if (isColumnId(id)) {
    return id;
  }

  return BOARD_STATUSES.find((status) => columns[status].some((task) => task.id === id)) ?? null;
}

/** Where a task sits, or null when it is not on the board. */
export function locate(columns: BoardColumns, taskId: string): BoardPlace | null {
  if (isColumnId(taskId)) {
    return null;
  }

  const status = columnOf(columns, taskId);

  return status ? { status, index: columns[status].findIndex((task) => task.id === taskId) } : null;
}

export function findTask(columns: BoardColumns, taskId: string): TaskListItem | null {
  const place = locate(columns, taskId);

  return place ? columns[place.status][place.index] : null;
}

/**
 * Carries a task into another column while it is dragged. It lands above the
 * task under the pointer — below it when `below` is set — or at the end when
 * the pointer is over the column itself. Within one column nothing changes:
 * that is what `reorderInColumn` is for.
 */
export function moveToColumn(
  columns: BoardColumns,
  taskId: string,
  overId: string,
  below = false,
): BoardColumns {
  const from = locate(columns, taskId);
  const to = columnOf(columns, overId);

  if (!from || !to || from.status === to) {
    return columns;
  }

  const task = columns[from.status][from.index];
  const target = columns[to];
  const overIndex = target.findIndex((candidate) => candidate.id === overId);
  const index = overIndex === -1 ? target.length : overIndex + (below ? 1 : 0);

  return {
    ...columns,
    [from.status]: columns[from.status].filter((candidate) => candidate.id !== taskId),
    [to]: [...target.slice(0, index), task, ...target.slice(index)],
  };
}

/** Moves a task within its own column into the place of `overId`. */
export function reorderInColumn(
  columns: BoardColumns,
  taskId: string,
  overId: string,
): BoardColumns {
  const from = locate(columns, taskId);
  const to = locate(columns, overId);

  if (!from || !to || from.status !== to.status || from.index === to.index) {
    return columns;
  }

  const tasks = [...columns[from.status]];
  const [task] = tasks.splice(from.index, 1);

  tasks.splice(to.index, 0, task);

  return { ...columns, [from.status]: tasks };
}

/** Sends a task to the end of a column — the path that needs no dragging. */
export function moveToEnd(
  columns: BoardColumns,
  taskId: string,
  status: BoardTaskStatus,
): BoardColumns {
  const from = locate(columns, taskId);

  if (!from) {
    return columns;
  }

  const task = columns[from.status][from.index];
  const without = {
    ...columns,
    [from.status]: columns[from.status].filter((candidate) => candidate.id !== taskId),
  };

  return { ...without, [status]: [...without[status], task] };
}

/**
 * What the API needs to place a task: the task directly above it and the one
 * directly below, as the column is shown. Tasks hidden by a filter may sit
 * between them; the API accepts that.
 */
export function neighboursOf(
  column: TaskListItem[],
  taskId: string,
): { afterTaskId: string | null; beforeTaskId: string | null } {
  const index = column.findIndex((task) => task.id === taskId);

  if (index === -1) {
    return { afterTaskId: null, beforeTaskId: null };
  }

  return {
    afterTaskId: index > 0 ? column[index - 1].id : null,
    beforeTaskId: index < column.length - 1 ? column[index + 1].id : null,
  };
}

/**
 * The board to show while the server confirms a move. Each column's total
 * follows the tasks that entered or left it, and `completedAt` follows the
 * API's rule: set on entering DONE, kept while there, cleared on leaving.
 */
export function applyColumns(
  board: TaskBoard,
  columns: BoardColumns,
  now: Date = new Date(),
): TaskBoard {
  return {
    ...board,
    columns: board.columns.map((column) => {
      const tasks = columns[column.status].map((task) => {
        const completedAt =
          column.status === 'DONE' ? (task.completedAt ?? now.toISOString()) : null;

        return task.status === column.status && task.completedAt === completedAt
          ? task
          : { ...task, status: column.status, completedAt };
      });

      return { ...column, total: column.total + tasks.length - column.tasks.length, tasks };
    }),
  };
}
