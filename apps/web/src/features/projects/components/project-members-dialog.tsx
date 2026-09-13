'use client';

import type { OrganizationMember } from '@nexo/types';
import { Loader2, Search, UserMinus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { ApiError, errorMessage } from '@/lib/api/errors';
import {
  useAddProjectMember,
  useOrganizationMembersQuery,
  useProjectMembersQuery,
  useRemoveProjectMember,
} from '../hooks/use-projects';

const MESSAGES: Record<string, string> = {
  PROJECT_MEMBER_ALREADY_EXISTS: 'Esa persona ya forma parte del proyecto.',
  PROJECT_MEMBER_NOT_IN_ORGANIZATION: 'Esa persona ya no pertenece a la organización.',
  PROJECT_MEMBER_NOT_FOUND: 'Esa persona ya no estaba en el proyecto.',
};

function failureMessage(error: unknown): string {
  const code = error instanceof ApiError ? String((error.body as { code?: string })?.code) : '';

  return MESSAGES[code] ?? errorMessage(error);
}

const fullName = (person: OrganizationMember) => `${person.firstName} ${person.lastName}`;

function PersonRow({ person, action }: { person: OrganizationMember; action?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <PersonAvatar person={person} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{fullName(person)}</p>
        <p className="text-muted-foreground truncate text-xs">
          {person.email} · {ROLE_LABELS[person.role]}
        </p>
      </div>
      {action}
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 py-1" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full rounded-lg" />
      ))}
    </div>
  );
}

/**
 * Assigns and removes project members.
 *
 * Candidates come only from the organization's existing members: nobody is
 * created or invited here. Both lists load only while the dialog is open.
 */
export function ProjectMembersDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
  canManage,
}: {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const [filter, setFilter] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const members = useProjectMembersQuery(projectId, open);
  const organization = useOrganizationMembersQuery(open && canManage);
  const add = useAddProjectMember(projectId);
  const remove = useRemoveProjectMember(projectId);

  const memberIds = new Set(members.data?.map((member) => member.userId));
  const term = filter.trim().toLowerCase();
  const candidates = (organization.data ?? [])
    .filter((person) => !memberIds.has(person.userId))
    .filter(
      (person) =>
        term === '' ||
        fullName(person).toLowerCase().includes(term) ||
        person.email.toLowerCase().includes(term),
    );

  const run = async (person: OrganizationMember, action: 'add' | 'remove') => {
    setBusyUserId(person.userId);

    try {
      if (action === 'add') {
        await add.mutateAsync(person.userId);
        toast.success(`${fullName(person)} se unió al proyecto.`);
      } else {
        await remove.mutateAsync(person.userId);
        toast.success(`${fullName(person)} salió del proyecto.`);
      }
    } catch (error) {
      toast.error(failureMessage(error));
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setFilter('');
        }

        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Equipo del proyecto</DialogTitle>
          <DialogDescription>{projectName}</DialogDescription>
        </DialogHeader>

        <section aria-labelledby="current-members" className="space-y-1">
          <h3
            id="current-members"
            className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
          >
            Miembros actuales
          </h3>

          {members.isPending ? (
            <ListSkeleton />
          ) : members.isError ? (
            <p role="alert" className="text-destructive py-2 text-sm">
              {errorMessage(members.error)}
            </p>
          ) : members.data.length === 0 ? (
            <p className="text-muted-foreground py-2 text-sm">Aún no hay miembros asignados.</p>
          ) : (
            <ul className="divide-border divide-y">
              {members.data.map((person) => (
                <PersonRow
                  key={person.userId}
                  person={person}
                  action={
                    canManage ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busyUserId !== null}
                        onClick={() => void run(person, 'remove')}
                        aria-label={`Quitar a ${fullName(person)} del proyecto`}
                      >
                        {busyUserId === person.userId ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <UserMinus className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )}
        </section>

        {canManage ? (
          <section aria-labelledby="add-members" className="space-y-3">
            <h3
              id="add-members"
              className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            >
              Agregar miembros
            </h3>

            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Buscar por nombre o correo"
                aria-label="Buscar miembros de la organización"
                className="pl-9"
              />
            </div>

            {organization.isPending || members.isPending ? (
              <ListSkeleton />
            ) : organization.isError ? (
              <p role="alert" className="text-destructive text-sm">
                {errorMessage(organization.error)}
              </p>
            ) : candidates.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {term
                  ? 'Nadie coincide con la búsqueda.'
                  : 'Todos los miembros ya están en el proyecto.'}
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {candidates.map((person) => (
                  <PersonRow
                    key={person.userId}
                    person={person}
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyUserId !== null}
                        onClick={() => void run(person, 'add')}
                        className="gap-1.5"
                        aria-label={`Agregar a ${fullName(person)} al proyecto`}
                      >
                        {busyUserId === person.userId ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <UserPlus className="size-4" aria-hidden="true" />
                        )}
                        Agregar
                      </Button>
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
