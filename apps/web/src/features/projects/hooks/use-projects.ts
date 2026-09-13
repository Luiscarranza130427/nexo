'use client';

import type {
  CreateProjectInput,
  ProjectDetail,
  ProjectListQuery,
  UpdateProjectInput,
} from '@nexo/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOrganizationMembers } from '@/lib/api/organization';
import {
  addProjectMember,
  createProject,
  deleteProject,
  fetchProject,
  fetchProjectMembers,
  fetchProjects,
  removeProjectMember,
  updateProject,
} from '../api/projects-api';
import { organizationMembersKey, projectKeys } from '../query-keys';

/** Paginated list. The server does the paging; the cache is keyed by the filters. */
export function useProjectsQuery(query: ProjectListQuery) {
  return useQuery({
    queryKey: projectKeys.list(query),
    queryFn: () => fetchProjects(query),
    // Keeps the previous page on screen while the next one loads.
    placeholderData: (previous) => previous,
  });
}

export function useProjectQuery(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => fetchProject(id),
    enabled: id.length > 0,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(id, input),
    onSuccess: async (project: ProjectDetail) => {
      // Seed the detail so the redirect renders the saved state at once.
      queryClient.setQueryData(projectKeys.detail(id), project);
      await queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: async (_result, id) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) });
      queryClient.removeQueries({ queryKey: projectKeys.members(id) });
      await queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useProjectMembersQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.members(projectId),
    queryFn: () => fetchProjectMembers(projectId),
    enabled: enabled && projectId.length > 0,
  });
}

/** Only fetched when a picker is actually open, and cached for five minutes. */
export function useOrganizationMembersQuery(enabled: boolean) {
  return useQuery({
    queryKey: organizationMembersKey,
    queryFn: fetchOrganizationMembers,
    enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * A membership change alters the member list, the detail's team section and
 * the list's member count — exactly those three, nothing broader.
 */
function useInvalidateProjectMembership(projectId: string) {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: projectKeys.members(projectId) }),
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
    ]);
  };
}

export function useAddProjectMember(projectId: string) {
  const invalidate = useInvalidateProjectMembership(projectId);

  return useMutation({
    mutationFn: (userId: string) => addProjectMember(projectId, { userId }),
    onSuccess: invalidate,
  });
}

export function useRemoveProjectMember(projectId: string) {
  const invalidate = useInvalidateProjectMembership(projectId);

  return useMutation({
    mutationFn: (userId: string) => removeProjectMember(projectId, userId),
    onSuccess: invalidate,
  });
}
