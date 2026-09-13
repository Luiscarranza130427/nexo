import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectBoardView } from '@/features/tasks/components/project-board-view';

export const metadata: Metadata = { title: 'Tablero' };

/** The board keeps its filters in the URL, so it needs a Suspense boundary. */
export default async function ProjectBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <ProjectBoardView projectId={id} />
    </Suspense>
  );
}
