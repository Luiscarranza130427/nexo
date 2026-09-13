import type {
  CreateTaskInput,
  MoveTaskInput,
  Paginated,
  TaskBoard,
  TaskBoardQuery,
  TaskDetail,
  TaskListItem,
  TaskListQuery,
  UpdateTaskInput,
} from '@nexo/types';
import { apiFetch } from '@/lib/api/client';
import { toQueryString } from '@/lib/api/query-string';

/**
 * Every call goes through the shared API client. Two things are never sent:
 * the organization, which the API takes from the session, and a position,
 * which the API computes.
 */

export function buildTasksQuery(query: TaskListQuery): string {
  return toQueryString(query);
}

export function buildBoardQuery(query: TaskBoardQuery): string {
  return toQueryString(query);
}

export function fetchTasks(query: TaskListQuery): Promise<Paginated<TaskListItem>> {
  return apiFetch<Paginated<TaskListItem>>(`/tasks${buildTasksQuery(query)}`);
}

export function fetchTaskBoard(query: TaskBoardQuery): Promise<TaskBoard> {
  return apiFetch<TaskBoard>(`/tasks/board${buildBoardQuery(query)}`);
}

export function fetchTask(id: string): Promise<TaskDetail> {
  return apiFetch<TaskDetail>(`/tasks/${id}`);
}

export function createTask(input: CreateTaskInput): Promise<TaskDetail> {
  return apiFetch<TaskDetail>('/tasks', { method: 'POST', body: input });
}

export function updateTask(id: string, input: UpdateTaskInput): Promise<TaskDetail> {
  return apiFetch<TaskDetail>(`/tasks/${id}`, { method: 'PATCH', body: input });
}

/** Where the task lands is described by its new neighbours, never by a position. */
export function moveTask(id: string, input: MoveTaskInput): Promise<TaskDetail> {
  return apiFetch<TaskDetail>(`/tasks/${id}/move`, { method: 'PATCH', body: input });
}

export function deleteTask(id: string): Promise<null> {
  return apiFetch<null>(`/tasks/${id}`, { method: 'DELETE' });
}
