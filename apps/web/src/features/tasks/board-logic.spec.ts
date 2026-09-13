import type { TaskBoard, TaskListItem } from '@nexo/types';
import {
  applyColumns,
  columnOf,
  findTask,
  locate,
  moveToColumn,
  moveToEnd,
  neighboursOf,
  reorderInColumn,
  toColumns,
} from './board-logic';

function task(id: string, status: TaskListItem['status'], position: number): TaskListItem {
  return {
    id,
    title: `Tarea ${id}`,
    status,
    priority: 'MEDIUM',
    position,
    startDate: null,
    dueDate: null,
    completedAt: status === 'DONE' ? '2026-09-01T10:00:00.000Z' : null,
    project: { id: 'project-1', code: 'NEX-001', name: 'Portal' },
    assignee: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

/** DONE shows one task out of five: the rest are hidden by a filter. */
function board(): TaskBoard {
  return {
    limitPerColumn: 200,
    columns: [
      {
        status: 'TODO',
        total: 3,
        tasks: [task('a', 'TODO', 1000), task('b', 'TODO', 2000), task('c', 'TODO', 3000)],
      },
      { status: 'IN_PROGRESS', total: 1, tasks: [task('d', 'IN_PROGRESS', 1000)] },
      { status: 'IN_REVIEW', total: 0, tasks: [] },
      { status: 'DONE', total: 5, tasks: [task('e', 'DONE', 1000)] },
    ],
  };
}

const ids = (tasks: TaskListItem[]) => tasks.map((candidate) => candidate.id);

describe('locating tasks and columns', () => {
  const columns = toColumns(board());

  it('resolves a column id and a task id to their column', () => {
    expect(columnOf(columns, 'IN_REVIEW')).toBe('IN_REVIEW');
    expect(columnOf(columns, 'd')).toBe('IN_PROGRESS');
    expect(columnOf(columns, 'missing')).toBeNull();
  });

  it('finds a task’s place, and nothing for a column id', () => {
    expect(locate(columns, 'b')).toEqual({ status: 'TODO', index: 1 });
    expect(locate(columns, 'TODO')).toBeNull();
    expect(findTask(columns, 'e')?.title).toBe('Tarea e');
  });
});

describe('reorderInColumn', () => {
  it('moves the last task to the top', () => {
    expect(ids(reorderInColumn(toColumns(board()), 'c', 'a').TODO)).toEqual(['c', 'a', 'b']);
  });

  it('moves the first task to the middle', () => {
    expect(ids(reorderInColumn(toColumns(board()), 'a', 'b').TODO)).toEqual(['b', 'a', 'c']);
  });

  it('leaves the board alone for a target in another column or the task itself', () => {
    const columns = toColumns(board());

    expect(reorderInColumn(columns, 'a', 'd')).toBe(columns);
    expect(reorderInColumn(columns, 'a', 'a')).toBe(columns);
  });
});

describe('moveToColumn', () => {
  it('lands above the task under the pointer, or below it', () => {
    const above = moveToColumn(toColumns(board()), 'a', 'd');
    const below = moveToColumn(toColumns(board()), 'a', 'd', true);

    expect(ids(above.IN_PROGRESS)).toEqual(['a', 'd']);
    expect(ids(below.IN_PROGRESS)).toEqual(['d', 'a']);
    expect(ids(above.TODO)).toEqual(['b', 'c']);
  });

  it('appends when dropped on a column itself, including an empty one', () => {
    expect(ids(moveToColumn(toColumns(board()), 'b', 'IN_REVIEW').IN_REVIEW)).toEqual(['b']);
    expect(ids(moveToColumn(toColumns(board()), 'b', 'DONE').DONE)).toEqual(['e', 'b']);
  });

  it('does nothing within the same column', () => {
    const columns = toColumns(board());

    expect(moveToColumn(columns, 'a', 'c')).toBe(columns);
  });
});

describe('moveToEnd', () => {
  it('sends a task to the end of another column', () => {
    const columns = moveToEnd(toColumns(board()), 'a', 'IN_PROGRESS');

    expect(ids(columns.IN_PROGRESS)).toEqual(['d', 'a']);
    expect(ids(columns.TODO)).toEqual(['b', 'c']);
  });
});

describe('neighboursOf', () => {
  const column = toColumns(board()).TODO;

  it('names the task above and the task below', () => {
    expect(neighboursOf(column, 'a')).toEqual({ afterTaskId: null, beforeTaskId: 'b' });
    expect(neighboursOf(column, 'b')).toEqual({ afterTaskId: 'a', beforeTaskId: 'c' });
    expect(neighboursOf(column, 'c')).toEqual({ afterTaskId: 'b', beforeTaskId: null });
  });

  it('sends no neighbours for a task alone in its column', () => {
    expect(neighboursOf([task('x', 'TODO', 1000)], 'x')).toEqual({
      afterTaskId: null,
      beforeTaskId: null,
    });
  });
});

describe('applyColumns', () => {
  const now = new Date('2026-10-01T12:00:00.000Z');

  it('follows a task through the workflow, keeping totals and completedAt in step', () => {
    const start = board();
    const done = applyColumns(start, moveToColumn(toColumns(start), 'a', 'DONE'), now);

    expect(done.columns.map((column) => column.total)).toEqual([2, 1, 0, 6]);
    expect(done.columns[3].tasks.at(-1)).toMatchObject({
      id: 'a',
      status: 'DONE',
      completedAt: now.toISOString(),
    });

    const reopened = applyColumns(done, moveToEnd(toColumns(done), 'a', 'TODO'), now);

    expect(reopened.columns.map((column) => column.total)).toEqual([3, 1, 0, 5]);
    expect(reopened.columns[0].tasks.at(-1)).toMatchObject({
      id: 'a',
      status: 'TODO',
      completedAt: null,
    });
  });

  it('keeps the original completion time of a task that stays done', () => {
    const start = board();
    const next = applyColumns(start, toColumns(start), now);

    expect(next.columns[3].tasks[0].completedAt).toBe('2026-09-01T10:00:00.000Z');
    expect(next.columns[3].tasks[0]).toBe(start.columns[3].tasks[0]);
  });

  it('never changes the board it was given', () => {
    const start = board();
    const snapshot = structuredClone(start);

    applyColumns(start, moveToColumn(toColumns(start), 'c', 'IN_REVIEW'), now);

    expect(start).toEqual(snapshot);
  });
});
