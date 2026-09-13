import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectsView } from '@/features/projects/components/projects-view';

export const metadata: Metadata = { title: 'Proyectos' };

/** `ProjectsView` reads the URL through `useSearchParams`, which needs a Suspense boundary. */
export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader
            title="Proyectos"
            description="Gestiona los proyectos, responsables, clientes y fechas de tu organización."
          />
          <Skeleton className="h-80 w-full rounded-xl" />
        </>
      }
    >
      <ProjectsView />
    </Suspense>
  );
}
