'use client';

import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/shared/access-denied';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { can } from '@/features/auth/permissions';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { useCreateProject, useProjectQuery, useUpdateProject } from '../hooks/use-projects';
import { ProjectForm } from './project-form';

/**
 * A project that does not exist and one that belongs to another organization
 * are indistinguishable here: the API answers 404 for both, on purpose.
 */
export function ProjectNotFound({ error }: { error: unknown }) {
  const missing = error instanceof ApiError && error.status === 404;

  return (
    <EmptyState
      icon={SearchX}
      title={missing ? 'Proyecto no encontrado' : 'No se pudo cargar el proyecto'}
      description={
        missing
          ? 'Este proyecto no existe o ya no está disponible en tu organización.'
          : errorMessage(error)
      }
      action={
        <Button asChild variant="outline">
          <Link href="/projects">Volver a proyectos</Link>
        </Button>
      }
    />
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function NewProjectView() {
  const { membership } = useAuth();
  const router = useRouter();
  const create = useCreateProject();

  // UX only — the API rejects the request regardless of what renders here.
  if (!can(membership?.role, 'projects:create')) {
    return (
      <AccessDenied action="crear proyectos" backHref="/projects" backLabel="Volver a proyectos" />
    );
  }

  return (
    <>
      <PageHeader
        title="Nuevo proyecto"
        description="El código se asigna automáticamente al crearlo."
      />
      <ProjectForm
        mode="create"
        onSubmit={async (values) => {
          const project = await create.mutateAsync(values);

          toast.success(`Proyecto ${project.code} creado.`);
          router.replace(`/projects/${project.id}`);
        }}
      />
    </>
  );
}

export function EditProjectView({ id }: { id: string }) {
  const { membership } = useAuth();
  const router = useRouter();
  const { data: project, isPending, isError, error } = useProjectQuery(id);
  const update = useUpdateProject(id);

  if (!can(membership?.role, 'projects:update')) {
    return (
      <AccessDenied action="editar proyectos" backHref="/projects" backLabel="Volver a proyectos" />
    );
  }

  if (isPending) {
    return (
      <>
        <PageHeader title="Editar proyecto" />
        <FormSkeleton />
      </>
    );
  }

  if (isError) {
    return <ProjectNotFound error={error} />;
  }

  return (
    <>
      <PageHeader title="Editar proyecto" description={`${project.code} · ${project.name}`} />
      <ProjectForm
        mode="edit"
        project={project}
        onSubmit={async (values) => {
          const updated = await update.mutateAsync(values);

          toast.success('Cambios guardados.');
          router.replace(`/projects/${updated.id}`);
        }}
      />
    </>
  );
}
