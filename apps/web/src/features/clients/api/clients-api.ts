import type {
  Client,
  ClientListQuery,
  CreateClientInput,
  Paginated,
  UpdateClientInput,
} from '@nexo/types';
import { apiFetch } from '@/lib/api/client';

/**
 * Serializes the list query, dropping empty values so the URL stays clean and
 * two equivalent filter states produce the same cache key.
 */
export function buildClientsQuery(query: ClientListQuery): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    params.set(key, String(value));
  }

  const search = params.toString();

  return search ? `?${search}` : '';
}

export function fetchClients(query: ClientListQuery): Promise<Paginated<Client>> {
  return apiFetch<Paginated<Client>>(`/clients${buildClientsQuery(query)}`);
}

export function fetchClient(id: string): Promise<Client> {
  return apiFetch<Client>(`/clients/${id}`);
}

export function createClient(input: CreateClientInput): Promise<Client> {
  return apiFetch<Client>('/clients', { method: 'POST', body: input });
}

export function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
  return apiFetch<Client>(`/clients/${id}`, { method: 'PATCH', body: input });
}

export function deleteClient(id: string): Promise<null> {
  return apiFetch<null>(`/clients/${id}`, { method: 'DELETE' });
}
