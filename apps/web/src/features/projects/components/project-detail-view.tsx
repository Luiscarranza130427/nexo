'use client';

import type { ProjectDetail } from '@nexo/types';
import { Building2, CalendarRange, ListChecks, Pencil, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { can } from '@/features/auth/permissions';
import { formatDateTime } from '@/lib/format-date';
import { useProjectQuery } from '../hooks/use-projects';
import { formatCalendarDate } from '../labels';
import { DueDateIndicator, ProjectPriorityBadge, ProjectStatusBadge } from './project-badges';
import { ProjectDeleteDialog } from './project-delete-dialog';
import { ProjectMembersDialog } from './project-members-dialog';
import { ProjectNotFound } from './project-views';

function SectionCard({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon className="text-muted-foreground size-4" aria-hidden="true" />
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-xl lg:col-span-2" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

/** Real counts from the API. Task management itself arrives in the next phase. */
function TaskSummary({ tasks }: { tasks: ProjectDetail['tasks'] }) {
  const cells = [
    { label: 'Total', value: tasks.total },
    { label: 'Por hacer', value: tasks.todo },
    { label: 'En progreso', value: tasks.inProgress },
    { label: 'En revisión', value: tasks.inReview },
    { label: 'Completadas', value: tasks.done },
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cells.map((cell) => (
          <div key={cell.label} className="bg-muted/50 rounded-lg px-3 py-2.5">
            <dt className="text-muted-foreground text-xs">{cell.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{cell.value}</dd>
          </div>
        ))}
      </dl>
      {tasks.total === 0 ? (
        <p className="text-muted-foreground text-sm">
          Este proyecto aún no tiene tareas. La gestión de tareas llegará en la siguiente fase.
        </p>
      ) : null}
    </div>
  );
}

export function ProjectDetailView({ id }: { id: string }) {
  const { membership } = useAuth();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [managingMembers, setManagingMembers] = useState(false);
  const { data: project, isPending, isError, error } = useProjectQuery(id);

  const role = membership?.role;
  const canUpdate = can(role, 'projects:update');
  const canDelete = can(role, 'projects:delete');
  const canManageMembers = can(role, 'projects:members');

  if (isPending) {
    return <DetailSkeleton />;
  }

  if (isError) {
    return <ProjectNotFound error={error} />;
  }

  return (
    <>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2.5">
          <p className="text-muted-foreground font-mono text-sm tracking-tight">{project.code}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <ProjectPriorityBadge priority={project.priority} />
            <DueDateIndicator dueDate={project.dueDate} status={project.status} className="ml-1" />
          </div>
        </div>

        {canUpdate || canDelete ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {canUpdate ? (
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/projects/${project.id}/edit`}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Editar
                </Link>
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="outline"
                onClick={() => setDeleting(true)}
                className="text-destructive hover:text-destructive gap-2"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Eliminar
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Resumen</CardTitle>
            </CardHeader>
            <CardContent>
              {project.description ? (
                <p className="text-sm leading-relaxed whitespace-pre-line text-pretty">
                  {project.description}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">Sin descripción.</p>
              )}
            </CardContent>
          </Card>

          <SectionCard icon={ListChecks} title="Tareas">
            <TaskSummary tasks={project.tasks} />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard icon={Building2} title="Cliente">
            {project.client ? (
              <Link
                href={`/clients/${project.client.id}`}
                className="hover:text-primary text-sm font-medium transition-colors"
              >
                {project.client.name}
              </Link>
            ) : (
              <p className="text-muted-foreground text-sm">Sin cliente asignado</p>
            )}
          </SectionCard>

          <SectionCard icon={CalendarRange} title="Fechas">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <dt className="text-muted-foreground text-xs">Inicio</dt>
                <dd>{project.startDate ? formatCalendarDate(project.startDate) : '—'}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-xs">Vencimiento</dt>
                <dd>{project.dueDate ? formatCalendarDate(project.dueDate) : '—'}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard
            icon={Users}
            title="Equipo"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setManagingMembers(true)}
                className="-my-1 h-8"
              >
                {canManageMembers ? 'Gestionar' : 'Ver todos'}
              </Button>
            }
          >
            {project.members.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin miembros asignados.</p>
            ) : (
              <ul className="space-y-3">
                {project.members.map((member) => (
                  <li key={member.userId} className="flex items-center gap-3">
                    <PersonAvatar person={member} className="size-7" />
                    <span className="truncate text-sm">
                      {member.firstName} {member.lastName}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Creado el {formatDateTime(project.createdAt)} · Última actualización el{' '}
        {formatDateTime(project.updatedAt)}
      </p>

      <ProjectDeleteDialog
        project={project}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => router.replace('/projects')}
      />

      <ProjectMembersDialog
        projectId={project.id}
        projectName={`${project.code} · ${project.name}`}
        open={managingMembers}
        onOpenChange={setManagingMembers}
        canManage={canManageMembers}
      />
    </>
  );
}
