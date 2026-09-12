import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientsView } from '@/features/clients/components/clients-view';

export const metadata: Metadata = { title: 'Clientes' };

/**
 * `ClientsView` reads the URL through `useSearchParams`, which Next requires to
 * sit inside a Suspense boundary so the shell can still be prerendered.
 */
export default function ClientsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader
            title="Clientes"
            description="Gestiona las personas y empresas con las que trabaja tu organización."
          />
          <Skeleton className="h-80 w-full rounded-xl" />
        </>
      }
    >
      <ClientsView />
    </Suspense>
  );
}
