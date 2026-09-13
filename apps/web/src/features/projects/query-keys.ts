import type { ProjectListQuery } from '@nexo/types';

/**
 * Query keys for the projects module.
 *
 * Hierarchical, so invalidation stays targeted. `members` sits beside `detail`
 * rather than under it: the breadcrumb reads `['projects', 'detail', id]` as an
 * exact key, and member lists have their own lifecycle.
 */
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: ProjectListQuery) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  members: (id: string) => [...projectKeys.all, 'members', id] as const,
};

/** People who can be assigned. Shared across features, cached briefly. */
export const organizationMembersKey = ['organization', 'members'] as const;
