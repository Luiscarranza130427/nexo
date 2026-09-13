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

/** Timestamp formatting is shared; re-exported so existing imports keep working. */
export { formatDate, formatDateTime } from '@/lib/format-date';
