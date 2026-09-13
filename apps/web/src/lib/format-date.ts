/**
 * Timestamps for people, not machines, in the viewer's own time zone.
 *
 * `Intl.DateTimeFormat` is built into the runtime, so no date library is pulled
 * in just to render a day and a month. Calendar dates stored at UTC midnight
 * (project start and due dates) need UTC formatting instead — see
 * `features/projects/labels.ts`.
 */
const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}
