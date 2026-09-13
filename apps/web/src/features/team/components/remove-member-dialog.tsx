'use client';

import type { TeamMember } from '@nexo/types';
import { useRouter } from 'next/navigation';
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
import { useAuth } from '@/features/auth/auth-provider';
import { useRemoveMember } from '../hooks/use-team';
import { fullName } from '../labels';
import { teamErrorMessage } from '../team-errors';

type RemoveMemberDialogProps = {
  member: TeamMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after someone else is removed, e.g. to leave their profile. */
  onRemoved?: () => void;
};

/**
 * Says exactly what removal does — and what it does not: the account is
 * never deleted, and nothing the person worked on is lost.
 */
export function RemoveMemberDialog({
  member,
  open,
  onOpenChange,
  onRemoved,
}: RemoveMemberDialogProps) {
  const { organization, user, logout } = useAuth();
  const router = useRouter();
  const remove = useRemoveMember();
  const [error, setError] = useState<string | null>(null);

  if (!member) {
    return null;
  }

  const name = fullName(member);
  const isSelf = member.userId === user?.id;
  const organizationName = organization?.name ?? 'la organización';

  const handleRemove = async () => {
    setError(null);

    try {
      await remove.mutateAsync(member.userId);
      toast.success(
        isSelf ? `Has salido de ${organizationName}.` : `${name} ya no forma parte del equipo.`,
      );
      onOpenChange(false);

      if (isSelf) {
        // This session was revoked together with the membership.
        await logout().catch(() => undefined);
        router.replace('/login');

        return;
      }

      onRemoved?.();
    } catch (cause) {
      // Stays open and says why: closing on failure would suggest it worked.
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
          <AlertDialogTitle>
            {isSelf ? '¿Salir del equipo?' : `¿Remover a ${name} del equipo?`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {isSelf ? 'Perderás' : 'Perderá'} el acceso a{' '}
                <strong className="text-foreground">{organizationName}</strong> al instante.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-left">
                <li>
                  {isSelf ? 'Saldrás' : 'Saldrá'} de todos los proyectos de esta organización.
                </li>
                <li>
                  {isSelf ? 'Tus' : 'Sus'} tareas aquí quedarán sin responsable; no se borran.
                </li>
                <li>
                  {isSelf ? 'Tu' : 'Su'} cuenta de Nexo no se elimina y conserva el acceso a otras
                  organizaciones.
                </li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault();
              void handleRemove();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {remove.isPending ? 'Removiendo…' : isSelf ? 'Salir del equipo' : 'Remover del equipo'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
