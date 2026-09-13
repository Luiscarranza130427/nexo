import type { InvitationListQuery, TeamListQuery } from '@nexo/types';

/**
 * Query keys for the team module.
 *
 * `detail` follows the `[resource, 'detail', id]` convention the breadcrumb
 * reads. Invitations sit beside the member lists: they change independently.
 */
export const teamKeys = {
  all: ['team'] as const,
  lists: () => [...teamKeys.all, 'list'] as const,
  list: (filters: TeamListQuery) => [...teamKeys.lists(), filters] as const,
  summary: () => [...teamKeys.all, 'summary'] as const,
  details: () => [...teamKeys.all, 'detail'] as const,
  detail: (userId: string) => [...teamKeys.details(), userId] as const,
  invitationLists: () => [...teamKeys.all, 'invitations'] as const,
  invitations: (filters: InvitationListQuery) => [...teamKeys.invitationLists(), filters] as const,
};

/** The public invitation page, outside the team root: it needs no session. */
export const invitationPreviewKey = (token: string) => ['invitation-preview', token] as const;
