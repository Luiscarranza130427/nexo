import type { ClientStatus, ClientType } from '@nexo/types';

/** Human wording. The interface never shows `COMPANY` or `PROSPECT` verbatim. */
export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  PERSON: 'Persona',
  COMPANY: 'Empresa',
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: 'Activo',
  PROSPECT: 'Prospecto',
  INACTIVE: 'Inactivo',
};

/**
 * Dates for people, not for machines.
 *
 * `Intl.DateTimeFormat` is built into the runtime, so no date library is pulled
 * in just to render a day and a month.
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
