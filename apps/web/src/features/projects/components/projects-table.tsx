'use client';

import type { ProjectListItem } from '@nexo/types';
import { Eye, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { formatCalendarDate } from '../labels';
import { DueDateIndicator, ProjectPriorityBadge, ProjectStatusBadge } from './project-badges';

export type ProjectPermissions = {
  canUpdate: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
};

type ProjectsTableProps = {
  projects: ProjectListItem[];
  permissions: ProjectPermissions;
  onManageMembers: (project: ProjectListItem) => void;
  onDelete: (project: ProjectListItem) => void;
};

/** Filtered by role. A MEMBER only ever sees "Ver". */
function RowActions({
  project,
  permissions,
  onManageMembers,
  onDelete,
}: {
  project: ProjectListItem;
  permissions: ProjectPermissions;
  onManageMembers: (project: ProjectListItem) => void;
  onDelete: (project: ProjectListItem) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Acciones para ${project.code}`}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href={`/projects/${project.id}`} className="gap-2">
            <Eye className="size-4" aria-hidden="true" />
            Ver
          </Link>
        </DropdownMenuItem>
        {permissions.canUpdate ? (
          <DropdownMenuItem asChild>
            <Link href={`/projects/${project.id}/edit`} className="gap-2">
              <Pencil className="size-4" aria-hidden="true" />
              Editar
            </Link>
          </DropdownMenuItem>
        ) : null}
        {permissions.canManageMembers ? (
          <DropdownMenuItem onSelect={() => onManageMembers(project)} className="gap-2">
            <Users className="size-4" aria-hidden="true" />
            Gestionar miembros
          </DropdownMenuItem>
        ) : null}
        {permissions.canDelete ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onDelete(project);
            }}
            className="text-destructive focus:text-destructive gap-2"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Eliminar
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ClientCell({ project }: { project: ProjectListItem }) {
  if (!project.client) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Link
      href={`/clients/${project.client.id}`}
      className="hover:text-primary truncate transition-colors"
    >
      {project.client.name}
    </Link>
  );
}

function DatesCell({ project }: { project: ProjectListItem }) {
  if (!project.startDate && !project.dueDate) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col gap-0.5 text-sm whitespace-nowrap">
      <span>
        {project.startDate ? formatCalendarDate(project.startDate) : '—'}
        <span className="text-muted-foreground px-1" aria-hidden="true">
          →
        </span>
        <span className="sr-only"> hasta </span>
        {project.dueDate ? formatCalendarDate(project.dueDate) : '—'}
      </span>
      <DueDateIndicator dueDate={project.dueDate} status={project.status} />
    </div>
  );
}

export function ProjectsTable({
  projects,
  permissions,
  onManageMembers,
  onDelete,
}: ProjectsTableProps) {
  return (
    <>
      {/* Desktop: a real table, with semantics assistive technology understands. */}
      <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Código</TableHead>
              <TableHead>Proyecto</TableHead>
              <TableHead className="hidden lg:table-cell">Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Fechas</TableHead>
              <TableHead className="hidden text-right xl:table-cell">Miembros</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {project.code}
                </TableCell>
                <TableCell className="max-w-64 font-medium">
                  <Link
                    href={`/projects/${project.id}`}
                    className="hover:text-primary block truncate transition-colors"
                  >
                    {project.name}
                  </Link>
                </TableCell>
                <TableCell className="hidden max-w-48 text-sm lg:table-cell">
                  <ClientCell project={project} />
                </TableCell>
                <TableCell>
                  <ProjectStatusBadge status={project.status} />
                </TableCell>
                <TableCell>
                  <ProjectPriorityBadge priority={project.priority} />
                </TableCell>
                <TableCell>
                  <DatesCell project={project} />
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-right text-sm xl:table-cell">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-4" aria-hidden="true" />
                    <span>
                      {project.membersCount}
                      <span className="sr-only"> miembros</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <RowActions
                    project={project}
                    permissions={permissions}
                    onManageMembers={onManageMembers}
                    onDelete={onDelete}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: compact cards instead of a table squeezed sideways. Works from 320px. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {projects.map((project) => (
          <li key={project.id} className="border-border bg-card rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground font-mono text-xs">{project.code}</span>
                  <ProjectStatusBadge status={project.status} />
                </div>

                <Link
                  href={`/projects/${project.id}`}
                  className="hover:text-primary block font-medium transition-colors"
                >
                  <span className="line-clamp-2">{project.name}</span>
                </Link>

                <p className="text-muted-foreground truncate text-sm">
                  {project.client ? project.client.name : 'Sin cliente'}
                </p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <ProjectPriorityBadge priority={project.priority} />
                  {project.dueDate ? (
                    <span className="text-muted-foreground text-xs">
                      Vence el {formatCalendarDate(project.dueDate)}
                    </span>
                  ) : null}
                  <DueDateIndicator dueDate={project.dueDate} status={project.status} />
                </div>
              </div>

              <RowActions
                project={project}
                permissions={permissions}
                onManageMembers={onManageMembers}
                onDelete={onDelete}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
