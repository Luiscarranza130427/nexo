import type { ClientListQuery } from '@nexo/types';

/**
 * Query keys for the clients module.
 *
 * Hierarchical on purpose: invalidating `lists()` touches every filter
 * combination without disturbing cached detail views, and vice versa. Nothing
 * here ever needs a blanket `invalidateQueries()`.
 */
export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (filters: ClientListQuery) => [...clientKeys.lists(), filters] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
};
