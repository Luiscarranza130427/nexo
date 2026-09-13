import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamView } from '@/features/team/components/team-view';

export const metadata: Metadata = { title: 'Equipo' };

/** `TeamView` keeps its tab and filters in the URL, which needs a Suspense boundary. */
export default function TeamPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader
            title="Equipo"
            description="Administra los miembros y accesos de tu organización."
          />
          <Skeleton className="h-80 w-full rounded-xl" />
        </>
      }
    >
      <TeamView />
    </Suspense>
  );
}
