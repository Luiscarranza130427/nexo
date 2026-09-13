'use client';

import type { AcceptInvitationInput } from '@nexo/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { acceptInvitation, fetchInvitationPreview } from '../api/team-api';
import { invitationPreviewKey } from '../query-keys';

/** No retries: an unknown or settled link will not become valid by asking again. */
export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: invitationPreviewKey(token),
    queryFn: () => fetchInvitationPreview(token),
    retry: false,
  });
}

/** The password goes straight into the request; nothing here keeps it. */
export function useAcceptInvitation(token: string) {
  return useMutation({
    mutationFn: (input: Omit<AcceptInvitationInput, 'token'>) =>
      acceptInvitation({ token, ...input }),
  });
}
