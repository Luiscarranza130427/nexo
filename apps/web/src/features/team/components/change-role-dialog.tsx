'use client';

import type { MembershipRole, TeamMember } from '@nexo/types';
import { Loader2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/features/auth/auth-provider';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { useChangeMemberRole } from '../hooks/use-team';
import { fullName } from '../labels';
import { affectsOwnership, assignableRolesFor } from '../permissions';
import { teamErrorMessage } from '../team-errors';
import { MemberRoleBadge } from './member-badges';
import { RoleOptions } from './role-options';

type ChangeRoleDialogProps = {
  /** Kept after closing, so the content does not vanish while the dialog fades out. */
  member: TeamMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChangeRoleDialog({ member, open, onOpenChange }: ChangeRoleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {/* The content unmounts when the dialog closes, so each opening starts fresh. */}
        {member ? <ChangeRoleForm member={member} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ownershipWarning(
  current: MembershipRole,
  next: MembershipRole,
  name: string,
  isSelf: boolean,
) {
  if (next === 'OWNER') {
    return `${name} será propietario: tendrá control total de la organización y de su equipo, incluido cambiar el rol de otros propietarios. Tú seguirás siendo propietario.`;
  }

  return isSelf
    ? 'Dejarás de ser propietario y perderás el control total de la organización. Solo es posible si queda otro propietario activo.'
    : `${name} dejará de ser propietario y perderá el control total de la organización.`;
}

function ChangeRoleForm({ member, onDone }: { member: TeamMember; onDone: () => void }) {
  const { membership, user, refreshSession } = useAuth();
  const change = useChangeMemberRole();
  const [role, setRole] = useState<MembershipRole>(member.role);
  const [error, setError] = useState<string | null>(null);

  const options = assignableRolesFor(membership?.role, member.role);
  const isSelf = member.userId === user?.id;
  const name = fullName(member);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await change.mutateAsync({ userId: member.userId, role });
      toast.success(`Rol de ${name}: ${ROLE_LABELS[role]}.`);

      // The caller's own permissions changed; the interface must follow at once.
      if (isSelf) {
        await refreshSession();
      }

      onDone();
    } catch (cause) {
      setError(teamErrorMessage(cause));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>Cambiar rol</DialogTitle>
        <DialogDescription>
          {name} · {member.email}
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Rol actual</span>
        <MemberRoleBadge role={member.role} />
      </div>

      <RoleOptions
        legend="Nuevo rol"
        name="member-role"
        roles={options}
        value={role}
        onChange={setRole}
        current={member.role}
      />

      {affectsOwnership(member.role, role) ? (
        <Alert>
          <TriangleAlert className="size-4" aria-hidden="true" />
          <AlertDescription>{ownershipWarning(member.role, role, name, isSelf)}</AlertDescription>
        </Alert>
      ) : isSelf && role !== member.role ? (
        <Alert>
          <TriangleAlert className="size-4" aria-hidden="true" />
          <AlertDescription>
            Estás cambiando tu propio rol. Perderás al instante los permisos que el nuevo rol no
            tenga.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={change.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={change.isPending || role === member.role} className="gap-2">
          {change.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Guardar rol
        </Button>
      </DialogFooter>
    </form>
  );
}
