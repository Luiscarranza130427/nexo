import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { TasksView } from '@/features/tasks/components/tasks-view';

export const metadata: Metadata = { title: 'Tareas' };

/** `TasksView` reads the URL through `useSearchParams`, which needs a Suspense boundary. */
export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Tareas" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </>
      }
    >
      <TasksView />
    </Suspense>
  );
}
