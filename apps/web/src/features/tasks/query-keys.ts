import type { TaskBoardQuery, TaskListQuery } from '@nexo/types';

/**
 * Query keys for the tasks module.
 *
 * `detail` follows the `[resource, 'detail', id]` convention the breadcrumb
 * relies on. Boards sit beside lists: both show the same tasks, so a change
 * invalidates the two together, while each keeps its own filters in its key.
 */
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: TaskListQuery) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  boards: () => [...taskKeys.all, 'board'] as const,
  board: (query: TaskBoardQuery) => [...taskKeys.boards(), query] as const,
};
