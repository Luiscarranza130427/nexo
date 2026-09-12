'use client';

import type { Client, ClientListQuery, CreateClientInput, UpdateClientInput } from '@nexo/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createClient,
  deleteClient,
  fetchClient,
  fetchClients,
  updateClient,
} from '../api/clients-api';
import { clientKeys } from '../query-keys';

/** Paginated list. The server does the paging; the cache is keyed by the filters. */
export function useClientsQuery(query: ClientListQuery) {
  return useQuery({
    queryKey: clientKeys.list(query),
    queryFn: () => fetchClients(query),
    // Keeps the previous page on screen while the next one loads, so the table
    // does not collapse to a skeleton on every page change.
    placeholderData: (previous) => previous,
  });
}

export function useClientQuery(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => fetchClient(id),
    enabled: id.length > 0,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClientInput) => createClient(input),
    onSuccess: async () => {
      // Only the lists are stale: a new client appears in them, and nothing
      // that was already cached as a detail has changed.
      await queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateClientInput) => updateClient(id, input),
    onSuccess: async (client: Client) => {
      // Seed the detail cache with the response so the redirect renders instantly.
      queryClient.setQueryData(clientKeys.detail(id), client);
      await queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: async (_result, id) => {
      queryClient.removeQueries({ queryKey: clientKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}
