'use client';

import type { TeamMemberDetail } from '@nexo/types';
import { FolderKanban, ListChecks, SearchX, Shield, UserMinus, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { ProjectStatusBadge } from '@/features/projects/components/project-badges';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { formatDate } from '@/lib/format-date';
import { useTeamMemberQuery } from '../hooks/use-team';
import { ROLE_DESCRIPTIONS, fullName } from '../labels';
import { hasAuthorityOver } from '../permissions';
import { ChangeRoleDialog } from './change-role-dialog';
import { MemberRoleBadge, MemberStatusBadge } from './member-badges';
import { RemoveMemberDialog } from './remove-member-dialog';

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}

/** A person who does not exist and one from another organization look the same: 404. */
function MemberNotFound({ error }: { error: unknown }) {
  const missing = error instanceof ApiError && error.status === 404;

  return (
    <EmptyState
      icon={SearchX}
      title={missing ? 'Miembro no encontrado' : 'No se pudo cargar el perfil'}
      description={
        missing
          ? 'Esta persona no existe o ya no forma parte de tu organización.'
          : errorMessage(error)
      }
      action={
        <Button asChild variant="outline">
          <Link href="/team">Volver al equipo</Link>
        </Button>
      }
    />
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function TaskCounts({ tasks }: { tasks: TeamMemberDetail['tasks'] }) {
  const cells = [
    { label: 'Total', value: tasks.total },
    { label: 'Por hacer', value: tasks.todo },
    { label: 'En progreso', value: tasks.inProgress },
    { label: 'En revisión', value: tasks.inReview },
    { label: 'Completadas', value: tasks.done },
    { label: 'Canceladas', value: tasks.cancelled },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-muted/50 rounded-lg px-3 py-2.5">
          <dt className="text-muted-foreground text-xs">{cell.label}</dt>
          <dd className="text-lg font-semibold tabular-nums">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MemberDetailView({ userId }: { userId: string }) {
  const { membership, user } = useAuth();
  const router = useRouter();
  const [changingRole, setChangingRole] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { data: member, isPending, isError, error } = useTeamMemberQuery(userId);

  if (isPending) {
    return <DetailSkeleton />;
  }

  if (isError) {
    return <MemberNotFound error={error} />;
  }

  const canManage = hasAuthorityOver(membership?.role, member.role);
  const isSelf = member.userId === user?.id;
  // The API only shows a MEMBER the projects they share with the person.
  const sharedOnly = membership?.role === 'MEMBER' && !isSelf;
  const name = fullName(member);

  return (
    <>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <PersonAvatar person={member} className="size-16 text-lg" />
          <div className="min-w-0 space-y-2">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight break-words">
              {name}
              {isSelf ? <Badge variant="secondary">Tú</Badge> : null}
            </h1>
            <p className="text-muted-foreground text-sm break-all">{member.email}</p>
            <div className="flex flex-wrap items-center gap-2">
              <MemberRoleBadge role={member.role} />
              <MemberStatusBadge status={member.status} />
            </div>
          </div>
        </div>

        {canManage ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setChangingRole(true)}>
              <Shield className="size-4" aria-hidden="true" />
              Cambiar rol
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive gap-2"
              onClick={() => setRemoving(true)}
            >
              <UserMinus className="size-4" aria-hidden="true" />
              {isSelf ? 'Salir del equipo' : 'Remover del equipo'}
            </Button>
          </div>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard icon={UserRound} title="Información">
          <dl className="space-y-4 text-sm">
            <Detail label="Rol">
              <span className="font-medium">{ROLE_LABELS[member.role]}</span>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {ROLE_DESCRIPTIONS[member.role]}
              </p>
            </Detail>
            <Detail label="Estado de la cuenta">
              <MemberStatusBadge status={member.status} />
            </Detail>
            <Detail label="Fecha de ingreso">{formatDate(member.joinedAt)}</Detail>
          </dl>
        </SectionCard>

        <div className="space-y-6 lg:col-span-2">
          <SectionCard
            icon={FolderKanban}
            title="Proyectos"
            action={
              <span className="text-muted-foreground text-sm tabular-nums">
                {member.projectsCount}
              </span>
            }
          >
            {member.projects.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {sharedOnly
                  ? 'No compartes ningún proyecto con esta persona.'
                  : 'No participa en ningún proyecto.'}
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {member.projects.map((project) => (
                  <li
                    key={project.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <Link
                      href={`/projects/${project.id}`}
                      className="hover:text-primary min-w-0 truncate transition-colors"
                    >
                      <span className="text-muted-foreground mr-2 font-mono text-xs">
                        {project.code}
                      </span>
                      <span className="text-sm font-medium">{project.name}</span>
                    </Link>
                    <ProjectStatusBadge status={project.status} />
                  </li>
                ))}
              </ul>
            )}
            {sharedOnly ? (
              <p className="text-muted-foreground mt-3 text-xs">
                Solo ves los proyectos que compartes con esta persona.
              </p>
            ) : member.projectsCount > member.projects.length ? (
              <p className="text-muted-foreground mt-3 text-xs">
                Se muestran {member.projects.length} de {member.projectsCount}.
              </p>
            ) : null}
          </SectionCard>

          <SectionCard
            icon={ListChecks}
            title="Tareas asignadas"
            action={
              <Button asChild variant="ghost" size="sm" className="-my-1 h-8">
                <Link href={`/tasks?assigneeId=${member.userId}`}>Ver tareas</Link>
              </Button>
            }
          >
            <TaskCounts tasks={member.tasks} />
            {sharedOnly ? (
              <p className="text-muted-foreground mt-3 text-xs">
                Solo se cuentan las tareas de los proyectos que compartes.
              </p>
            ) : null}
          </SectionCard>
        </div>
      </div>

      <ChangeRoleDialog member={member} open={changingRole} onOpenChange={setChangingRole} />
      <RemoveMemberDialog
        member={member}
        open={removing}
        onOpenChange={setRemoving}
        onRemoved={() => router.replace('/team')}
      />
    </>
  );
}
