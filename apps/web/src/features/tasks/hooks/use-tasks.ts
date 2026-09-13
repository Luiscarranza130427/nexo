'use client';

import type {
  CreateTaskInput,
  MoveTaskInput,
  TaskBoard,
  TaskBoardQuery,
  TaskListQuery,
  UpdateTaskInput,
} from '@nexo/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { projectKeys } from '@/features/projects/query-keys';
import {
  createTask,
  deleteTask,
  fetchTask,
  fetchTaskBoard,
  fetchTasks,
  moveTask,
  updateTask,
} from '../api/tasks-api';
import { taskKeys } from '../query-keys';

/** Paginated list. The server does the paging; the cache is keyed by the filters. */
export function useTasksQuery(query: TaskListQuery) {
  return useQuery({
    queryKey: taskKeys.list(query),
    queryFn: () => fetchTasks(query),
    placeholderData: (previous) => previous,
  });
}

/** `null` means no task is open, and nothing is fetched. */
export function useTaskQuery(id: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => fetchTask(id as string),
    enabled: Boolean(id),
  });
}

/** Keeps the current board on screen while a new filter loads. */
export function useTaskBoardQuery(query: TaskBoardQuery, enabled = true) {
  return useQuery({
    queryKey: taskKeys.board(query),
    queryFn: () => fetchTaskBoard(query),
    placeholderData: (previous) => previous,
    enabled,
  });
}

/** Loads a task's full detail on demand — for editing from a card or a row. */
export function useLoadTask() {
  const queryClient = useQueryClient();

  return useCallback(
    (id: string) =>
      queryClient.fetchQuery({
        queryKey: taskKeys.detail(id),
        queryFn: () => fetchTask(id),
        staleTime: 10_000,
      }),
    [queryClient],
  );
}

/**
 * A task change can alter the lists, the boards and the task counts on its
 * project's page — exactly those, nothing broader.
 */
function useInvalidateTaskViews() {
  const queryClient = useQueryClient();

  return (projectId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: taskKeys.boards() }),
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
    ]);
}

export function useCreateTask() {
  const invalidate = useInvalidateTaskViews();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: (task) => invalidate(task.project.id),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTaskViews();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) => updateTask(id, input),
    onSuccess: async (task) => {
      // The open detail shows the saved state at once.
      queryClient.setQueryData(taskKeys.detail(task.id), task);
      await invalidate(task.project.id);
    },
  });
}

export type MoveTaskVariables = {
  taskId: string;
  projectId: string;
  input: MoveTaskInput;
  /** The board on screen, and how it looks once the move is applied. */
  board: { key: ReturnType<typeof taskKeys.board>; next: TaskBoard };
};

/**
 * Moves a task and shows the result before the server confirms it.
 *
 * The board is rewritten at once, so the card stays where it was dropped. If
 * the API refuses — usually because someone changed the column meanwhile — the
 * snapshot is restored and the board is refetched either way.
 */
export function useMoveTask() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTaskViews();

  return useMutation({
    mutationFn: ({ taskId, input }: MoveTaskVariables) => moveTask(taskId, input),
    onMutate: async ({ board }) => {
      // An in-flight refetch must not land on top of the optimistic board.
      await queryClient.cancelQueries({ queryKey: board.key });

      const previous = queryClient.getQueryData<TaskBoard>(board.key);

      queryClient.setQueryData(board.key, board.next);

      return { previous };
    },
    onError: (_error, { board }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(board.key, context.previous);
      }
    },
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(task.id), task);
    },
    onSettled: (_task, _error, { projectId }) => invalidate(projectId),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTaskViews();

  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => deleteTask(id),
    onSuccess: async (_result, { id, projectId }) => {
      queryClient.removeQueries({ queryKey: taskKeys.detail(id) });
      await invalidate(projectId);
    },
  });
}
