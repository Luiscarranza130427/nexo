'use client';

import type { Invitation } from '@nexo/types';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRevokeInvitation } from '../hooks/use-team';
import { teamErrorMessage } from '../team-errors';

export function RevokeInvitationDialog({
  invitation,
  open,
  onOpenChange,
}: {
  invitation: Invitation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const revoke = useRevokeInvitation();
  const [error, setError] = useState<string | null>(null);

  if (!invitation) {
    return null;
  }

  const handleRevoke = async () => {
    setError(null);

    try {
      await revoke.mutateAsync(invitation.id);
      toast.success(`Invitación a ${invitation.email} revocada.`);
      onOpenChange(false);
    } catch (cause) {
      setError(teamErrorMessage(cause));
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
        }

        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Revocar la invitación?</AlertDialogTitle>
          <AlertDialogDescription>
            El enlace enviado a{' '}
            <strong className="text-foreground break-all">{invitation.email}</strong> dejará de
            funcionar. Si hace falta, podrás crear una invitación nueva.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={revoke.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={revoke.isPending}
            onClick={(event) => {
              event.preventDefault();
              void handleRevoke();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {revoke.isPending ? 'Revocando…' : 'Revocar invitación'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
