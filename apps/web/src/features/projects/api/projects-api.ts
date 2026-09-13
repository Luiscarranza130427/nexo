import type {
  AddProjectMemberInput,
  CreateProjectInput,
  OrganizationMember,
  Paginated,
  ProjectDetail,
  ProjectListItem,
  ProjectListQuery,
  UpdateProjectInput,
} from '@nexo/types';
import { apiFetch } from '@/lib/api/client';
import { toQueryString } from '@/lib/api/query-string';

/**
 * Every call goes through the shared API client: credentials, token refresh and
 * error normalization are never reimplemented here. The organization is never
 * sent — the API takes it from the session.
 */

export function buildProjectsQuery(query: ProjectListQuery): string {
  return toQueryString(query);
}

export function fetchProjects(query: ProjectListQuery): Promise<Paginated<ProjectListItem>> {
  return apiFetch<Paginated<ProjectListItem>>(`/projects${buildProjectsQuery(query)}`);
}

export function fetchProject(id: string): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/projects/${id}`);
}

/** No `code` here or anywhere in the frontend: the API generates it. */
export function createProject(input: CreateProjectInput): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>('/projects', { method: 'POST', body: input });
}

export function updateProject(id: string, input: UpdateProjectInput): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/projects/${id}`, { method: 'PATCH', body: input });
}

export function deleteProject(id: string): Promise<null> {
  return apiFetch<null>(`/projects/${id}`, { method: 'DELETE' });
}

export function fetchProjectMembers(projectId: string): Promise<OrganizationMember[]> {
  return apiFetch<OrganizationMember[]>(`/projects/${projectId}/members`);
}

export function addProjectMember(
  projectId: string,
  input: AddProjectMemberInput,
): Promise<OrganizationMember> {
  return apiFetch<OrganizationMember>(`/projects/${projectId}/members`, {
    method: 'POST',
    body: input,
  });
}

export function removeProjectMember(projectId: string, userId: string): Promise<null> {
  return apiFetch<null>(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
}
