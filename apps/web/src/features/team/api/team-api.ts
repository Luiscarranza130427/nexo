import type {
  AcceptInvitationInput,
  AcceptedInvitation,
  ChangeMemberRoleInput,
  CreateInvitationInput,
  CreatedInvitation,
  Invitation,
  InvitationListQuery,
  InvitationPreview,
  Paginated,
  TeamListQuery,
  TeamMember,
  TeamMemberDetail,
  TeamSummary,
} from '@nexo/types';
import { apiFetch } from '@/lib/api/client';
import { toQueryString } from '@/lib/api/query-string';

/**
 * Every call goes through the shared API client. The organization is never
 * sent: the API takes it from the session.
 */

export function buildTeamQuery(query: TeamListQuery): string {
  return toQueryString(query);
}

export function buildInvitationsQuery(query: InvitationListQuery): string {
  return toQueryString(query);
}

export function fetchTeam(query: TeamListQuery): Promise<Paginated<TeamMember>> {
  return apiFetch<Paginated<TeamMember>>(`/team${buildTeamQuery(query)}`);
}

export function fetchTeamSummary(): Promise<TeamSummary> {
  return apiFetch<TeamSummary>('/team/summary');
}

export function fetchTeamMember(userId: string): Promise<TeamMemberDetail> {
  return apiFetch<TeamMemberDetail>(`/team/${userId}`);
}

export function changeMemberRole(
  userId: string,
  input: ChangeMemberRoleInput,
): Promise<TeamMember> {
  return apiFetch<TeamMember>(`/team/${userId}/role`, { method: 'PATCH', body: input });
}

export function removeMember(userId: string): Promise<null> {
  return apiFetch<null>(`/team/${userId}`, { method: 'DELETE' });
}

export function fetchInvitations(query: InvitationListQuery): Promise<Paginated<Invitation>> {
  return apiFetch<Paginated<Invitation>>(`/team/invitations${buildInvitationsQuery(query)}`);
}

export function createInvitation(input: CreateInvitationInput): Promise<CreatedInvitation> {
  return apiFetch<CreatedInvitation>('/team/invitations', { method: 'POST', body: input });
}

export function revokeInvitation(id: string): Promise<Invitation> {
  return apiFetch<Invitation>(`/team/invitations/${id}/revoke`, { method: 'POST' });
}

/** Public. An invitee usually has no session, so there is nothing to refresh. */
export function fetchInvitationPreview(token: string): Promise<InvitationPreview> {
  return apiFetch<InvitationPreview>(`/invitations/${encodeURIComponent(token)}`, {
    skipRefresh: true,
  });
}

/**
 * Public. `skipRefresh` matters: a wrong password answers 401, which must read
 * as a wrong password, never as a lost session to refresh.
 */
export function acceptInvitation(input: AcceptInvitationInput): Promise<AcceptedInvitation> {
  return apiFetch<AcceptedInvitation>('/invitations/accept', {
    method: 'POST',
    body: input,
    skipRefresh: true,
  });
}
