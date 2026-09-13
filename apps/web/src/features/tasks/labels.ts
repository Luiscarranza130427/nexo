import type {
  BoardTaskStatus,
  SortOrder,
  TaskAssignee,
  TaskSortField,
  TaskStatus,
} from '@nexo/types';
import { describeDueDate, type DueDateInfo } from '@/features/projects/labels';

/** Human wording. The interface never shows `IN_REVIEW` verbatim. */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW: 'En revisión',
  DONE: 'Completada',
  CANCELLED: 'Cancelada',
};

/** Declaration order, which is also the workflow order. */
export const TASK_STATUSES = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];

/** Board columns, in workflow order. Cancelled tasks are only reachable from the list. */
export const BOARD_STATUSES: BoardTaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

/** One control for sorting; the first option is the API's own default. */
export const TASK_SORT_OPTIONS: { value: `${TaskSortField}:${SortOrder}`; label: string }[] = [
  { value: 'createdAt:desc', label: 'Más recientes' },
  { value: 'createdAt:asc', label: 'Más antiguas' },
  { value: 'dueDate:asc', label: 'Vencimiento más próximo' },
  { value: 'priority:desc', label: 'Prioridad más alta' },
  { value: 'title:asc', label: 'Título (A–Z)' },
  { value: 'startDate:asc', label: 'Inicio más próximo' },
  { value: 'updatedAt:desc', label: 'Actualizadas recientemente' },
];

/**
 * How close a task's due date is. A done or cancelled task gets no
 * indicator: being "overdue" no longer means anything for it.
 */
export function taskDueDateInfo(
  dueIso: string | null,
  status: TaskStatus,
  now: Date = new Date(),
): DueDateInfo | null {
  if (!dueIso || status === 'DONE' || status === 'CANCELLED') {
    return null;
  }

  return describeDueDate(dueIso, now);
}

export function assigneeName(assignee: Pick<TaskAssignee, 'firstName' | 'lastName'> | null) {
  return assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Sin asignar';
}
