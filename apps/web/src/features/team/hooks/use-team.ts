'use client';

import type { InvitationListQuery, MembershipRole, TeamListQuery } from '@nexo/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationMembersKey, projectKeys } from '@/features/projects/query-keys';
import { taskKeys } from '@/features/tasks/query-keys';
import {
  changeMemberRole,
  createInvitation,
  fetchInvitations,
  fetchTeam,
  fetchTeamMember,
  fetchTeamSummary,
  removeMember,
  revokeInvitation,
} from '../api/team-api';
import { teamKeys } from '../query-keys';

/** Paginated on the server; the cache is keyed by the filters. */
export function useTeamQuery(query: TeamListQuery) {
  return useQuery({
    queryKey: teamKeys.list(query),
    queryFn: () => fetchTeam(query),
    placeholderData: (previous) => previous,
  });
}

export function useTeamSummaryQuery() {
  return useQuery({ queryKey: teamKeys.summary(), queryFn: fetchTeamSummary });
}

export function useTeamMemberQuery(userId: string) {
  return useQuery({
    queryKey: teamKeys.detail(userId),
    queryFn: () => fetchTeamMember(userId),
    enabled: userId.length > 0,
  });
}

export function useInvitationsQuery(query: InvitationListQuery) {
  return useQuery({
    queryKey: teamKeys.invitations(query),
    queryFn: () => fetchInvitations(query),
    placeholderData: (previous) => previous,
  });
}

export function useChangeMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MembershipRole }) =>
      changeMemberRole(userId, { role }),
    onSuccess: (_member, { userId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: teamKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: teamKeys.summary() }),
        queryClient.invalidateQueries({ queryKey: teamKeys.detail(userId) }),
        // Pickers show the role too.
        queryClient.invalidateQueries({ queryKey: organizationMembersKey }),
      ]),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => removeMember(userId),
    onSuccess: (_result, userId) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: teamKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: teamKeys.summary() }),
        // Marked stale without refetching: the open profile is about to be left.
        queryClient.invalidateQueries({ queryKey: teamKeys.detail(userId), refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: organizationMembersKey }),
        // Removal also empties their project seats and unassigns their tasks.
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
        queryClient.invalidateQueries({ queryKey: taskKeys.all }),
      ]),
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.invitationLists() }),
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.invitationLists() }),
  });
}
