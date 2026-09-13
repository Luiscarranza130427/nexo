/**
 * Pure rules for ordering and completing tasks. No database access, so every
 * case is cheap to test on its own.
 */

/**
 * Distance between consecutive positions in a freshly ordered column.
 *
 * Leaving room between neighbours means most moves change one row instead of
 * renumbering the whole column. About ten insertions into the same spot exhaust
 * the room, at which point the column is renormalized.
 */
export const POSITION_GAP = 1000;

export type Slot = {
  id: string;
  position: number;
};

/**
 * Index at which a task lands in a column that does not contain it.
 *
 * `afterTaskId` is the task that will sit directly above; `beforeTaskId` the one
 * directly below. With both, they must appear in that order — they need not be
 * adjacent, since a filtered board can hide tasks between them. Returns `null`
 * when a neighbour is not in the column or the order is impossible.
 */
export function insertionIndex(
  column: readonly Slot[],
  afterTaskId?: string | null,
  beforeTaskId?: string | null,
): number | null {
  const afterIndex = afterTaskId ? column.findIndex((slot) => slot.id === afterTaskId) : -1;
  const beforeIndex = beforeTaskId ? column.findIndex((slot) => slot.id === beforeTaskId) : -1;

  if ((afterTaskId && afterIndex === -1) || (beforeTaskId && beforeIndex === -1)) {
    return null;
  }

  if (afterTaskId && beforeTaskId) {
    return afterIndex < beforeIndex ? afterIndex + 1 : null;
  }

  if (afterTaskId) {
    return afterIndex + 1;
  }

  if (beforeTaskId) {
    return beforeIndex;
  }

  return column.length;
}

/**
 * A position for a task inserted at `index`, or `null` when its neighbours are
 * adjacent integers and there is no room left between them.
 */
export function positionAt(column: readonly Slot[], index: number): number | null {
  const previous = index > 0 ? column[index - 1] : undefined;
  const next = index < column.length ? column[index] : undefined;

  if (!previous && !next) {
    return POSITION_GAP;
  }

  if (!previous && next) {
    return next.position - POSITION_GAP;
  }

  if (previous && !next) {
    return previous.position + POSITION_GAP;
  }

  const room = (next as Slot).position - (previous as Slot).position;

  return room > 1 ? (previous as Slot).position + Math.floor(room / 2) : null;
}

/** Evenly spaced positions for a column of `count` tasks: 1000, 2000, 3000… */
export function normalizedPositions(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 1) * POSITION_GAP);
}

type Status = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';

/**
 * `completedAt` after a status change: set on entering DONE, kept while it stays
 * DONE, cleared on leaving it. Pass `null` as the previous status for a new task.
 */
export function completedAtFor(
  previousStatus: Status | null,
  nextStatus: Status,
  previousCompletedAt: Date | null,
  now: Date = new Date(),
): Date | null {
  if (nextStatus !== 'DONE') {
    return null;
  }

  return previousStatus === 'DONE' && previousCompletedAt ? previousCompletedAt : now;
}
