import type { OrganizationMember } from '@nexo/types';
import { apiFetch } from './client';

/**
 * Active members of the caller's organization, for selection lists.
 * The full team module comes later; this only feeds pickers.
 */
export function fetchOrganizationMembers(): Promise<OrganizationMember[]> {
  return apiFetch<OrganizationMember[]>('/organization/members');
}
