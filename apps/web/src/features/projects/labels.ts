import type { Priority, ProjectSortField, ProjectStatus, SortOrder } from '@nexo/types';

/** Human wording. The interface never shows `ON_HOLD` or `URGENT` verbatim. */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: 'Planificación',
  ACTIVE: 'Activo',
  ON_HOLD: 'En pausa',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

/** Declaration order, which is also the natural order to offer them in. */
export const PROJECT_STATUSES = Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[];

export const PRIORITIES = Object.keys(PRIORITY_LABELS) as Priority[];

/** One control for sorting, usable the same way on a phone and a desktop. */
export const PROJECT_SORT_OPTIONS: { value: `${ProjectSortField}:${SortOrder}`; label: string }[] =
  [
    { value: 'createdAt:desc', label: 'Más recientes' },
    { value: 'createdAt:asc', label: 'Más antiguos' },
    { value: 'name:asc', label: 'Nombre (A–Z)' },
    { value: 'name:desc', label: 'Nombre (Z–A)' },
    { value: 'code:asc', label: 'Código' },
    { value: 'dueDate:asc', label: 'Vencimiento más próximo' },
    { value: 'startDate:asc', label: 'Inicio más próximo' },
    { value: 'priority:desc', label: 'Prioridad más alta' },
    { value: 'updatedAt:desc', label: 'Actualizados recientemente' },
  ];

/**
 * Project dates are calendar dates stored at UTC midnight, so they are
 * formatted in UTC. Formatting them in the local zone would show 30 sep for a
 * 1 oct due date anywhere west of Greenwich — including Lima.
 */
const calendarFormatter = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatCalendarDate(iso: string): string {
  return calendarFormatter.format(new Date(iso));
}

/** `2026-10-01T00:00:00.000Z` becomes `2026-10-01`, the value a date input expects. */
export function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export type DueDateInfo = {
  tone: 'overdue' | 'today' | 'soon' | 'upcoming';
  label: string;
};

const DAY_MS = 86_400_000;

/**
 * How close a due date is, for display only — not an alerting system.
 *
 * Compares calendar days: the viewer's local today against the stored date.
 * A completed or cancelled project gets no indicator, since being "overdue"
 * no longer means anything for it.
 */
export function dueDateInfo(
  dueIso: string | null,
  status: ProjectStatus,
  now: Date = new Date(),
): DueDateInfo | null {
  if (!dueIso || status === 'COMPLETED' || status === 'CANCELLED') {
    return null;
  }

  const due = Date.parse(`${dueIso.slice(0, 10)}T00:00:00.000Z`);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due - today) / DAY_MS);

  if (days < 0) {
    return { tone: 'overdue', label: days === -1 ? 'Venció ayer' : `Vencido hace ${-days} días` };
  }

  if (days === 0) {
    return { tone: 'today', label: 'Vence hoy' };
  }

  if (days === 1) {
    return { tone: 'soon', label: 'Vence mañana' };
  }

  return { tone: days <= 7 ? 'soon' : 'upcoming', label: `Vence en ${days} días` };
}
