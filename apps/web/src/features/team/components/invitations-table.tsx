'use client';

import type { Invitation } from '@nexo/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { fullName } from '../labels';
import { InvitationStatusBadge } from './member-badges';

type InvitationsTableProps = {
  invitations: Invitation[];
  onRevoke: (invitation: Invitation) => void;
};

function RevokeButton({
  invitation,
  onRevoke,
}: {
  invitation: Invitation;
  onRevoke: InvitationsTableProps['onRevoke'];
}) {
  // Only a pending invitation can still be used, so only it can be revoked.
  if (invitation.status !== 'PENDING') {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onRevoke(invitation)}
      className="text-destructive hover:text-destructive"
      aria-label={`Revocar la invitación a ${invitation.email}`}
    >
      Revocar
    </Button>
  );
}

const inviter = (invitation: Invitation) =>
  invitation.invitedBy ? fullName(invitation.invitedBy) : '—';

export function InvitationsTable({ invitations, onRevoke }: InvitationsTableProps) {
  return (
    <>
      <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead className="hidden lg:table-cell">Invitada por</TableHead>
              <TableHead className="hidden xl:table-cell">Creada</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => (
              <TableRow key={invitation.id}>
                <TableCell className="max-w-64 truncate font-medium">{invitation.email}</TableCell>
                <TableCell className="text-sm">{ROLE_LABELS[invitation.role]}</TableCell>
                <TableCell>
                  <InvitationStatusBadge status={invitation.status} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {formatDateTime(invitation.expiresAt)}
                </TableCell>
                <TableCell className="text-muted-foreground hidden max-w-48 truncate text-sm lg:table-cell">
                  {inviter(invitation)}
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm whitespace-nowrap xl:table-cell">
                  {formatDate(invitation.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <RevokeButton invitation={invitation} onRevoke={onRevoke} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="border-border bg-card rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <p className="truncate font-medium">{invitation.email}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <InvitationStatusBadge status={invitation.status} />
                  <span className="text-muted-foreground text-sm">
                    {ROLE_LABELS[invitation.role]}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Expira el {formatDateTime(invitation.expiresAt)} · Invitada por{' '}
                  {inviter(invitation)}
                </p>
              </div>
              <RevokeButton invitation={invitation} onRevoke={onRevoke} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
