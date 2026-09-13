'use client';

import type { MembershipRole, TeamMember } from '@nexo/types';
import { MoreHorizontal, Shield, UserMinus, UserRound } from 'lucide-react';
import Link from 'next/link';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import { fullName } from '../labels';
import { hasAuthorityOver } from '../permissions';
import { MemberRoleBadge, MemberStatusBadge } from './member-badges';

type TeamTableProps = {
  members: TeamMember[];
  actorRole: MembershipRole | undefined;
  currentUserId: string | undefined;
  onChangeRole: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
};

/** Only what the actor may actually do. Everyone can open a profile. */
function MemberActions({
  member,
  canManage,
  isSelf,
  onChangeRole,
  onRemove,
}: {
  member: TeamMember;
  canManage: boolean;
  isSelf: boolean;
  onChangeRole: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Acciones para ${fullName(member)}`}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/team/${member.userId}`} className="gap-2">
            <UserRound className="size-4" aria-hidden="true" />
            Ver perfil
          </Link>
        </DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuItem onSelect={() => onChangeRole(member)} className="gap-2">
              <Shield className="size-4" aria-hidden="true" />
              Cambiar rol
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onRemove(member);
              }}
              className="text-destructive focus:text-destructive gap-2"
            >
              <UserMinus className="size-4" aria-hidden="true" />
              {isSelf ? 'Salir del equipo' : 'Remover del equipo'}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Identity({
  member,
  isSelf,
  emailClassName,
}: {
  member: TeamMember;
  isSelf: boolean;
  emailClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PersonAvatar person={member} className="size-9" />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/team/${member.userId}`}
            className="hover:text-primary truncate font-medium transition-colors"
          >
            {fullName(member)}
          </Link>
          {isSelf ? (
            <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
              Tú
            </Badge>
          ) : null}
        </div>
        <p className={cn('text-muted-foreground truncate text-sm', emailClassName)}>
          {member.email}
        </p>
      </div>
    </div>
  );
}

export function TeamTable({
  members,
  actorRole,
  currentUserId,
  onChangeRole,
  onRemove,
}: TeamTableProps) {
  const actionsFor = (member: TeamMember) => (
    <MemberActions
      member={member}
      canManage={hasAuthorityOver(actorRole, member.role)}
      isSelf={member.userId === currentUserId}
      onChangeRole={onChangeRole}
      onRemove={onRemove}
    />
  );

  return (
    <>
      {/* Desktop: a real table, with semantics assistive technology understands. */}
      <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Miembro</TableHead>
              <TableHead className="hidden lg:table-cell">Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden text-right xl:table-cell">Proyectos</TableHead>
              <TableHead className="hidden lg:table-cell">Fecha de ingreso</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.userId}>
                <TableCell className="max-w-72">
                  <Identity
                    member={member}
                    isSelf={member.userId === currentUserId}
                    emailClassName="lg:hidden"
                  />
                </TableCell>
                <TableCell className="text-muted-foreground hidden max-w-64 truncate text-sm lg:table-cell">
                  {member.email}
                </TableCell>
                <TableCell>
                  <MemberRoleBadge role={member.role} />
                </TableCell>
                <TableCell>
                  <MemberStatusBadge status={member.status} />
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-right text-sm tabular-nums xl:table-cell">
                  {member.projectsCount}
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm whitespace-nowrap lg:table-cell">
                  {formatDate(member.joinedAt)}
                </TableCell>
                <TableCell>{actionsFor(member)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: compact cards instead of a table squeezed sideways. Works from 320px. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {members.map((member) => (
          <li key={member.userId} className="border-border bg-card rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-3">
                <Identity member={member} isSelf={member.userId === currentUserId} />
                <div className="flex flex-wrap items-center gap-2">
                  <MemberRoleBadge role={member.role} />
                  <MemberStatusBadge status={member.status} />
                </div>
              </div>
              {actionsFor(member)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
