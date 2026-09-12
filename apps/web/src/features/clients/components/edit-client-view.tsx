'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { can } from '@/features/auth/permissions';
import { useClientQuery, useUpdateClient } from '../hooks/use-clients';
import { ClientForm } from './client-form';
import { ClientNotFound } from './client-not-found';
import { ClientsAccessDenied } from './clients-access-denied';

export function EditClientView({ id }: { id: string }) {
  const { membership } = useAuth();
  const router = useRouter();
  const { data: client, isPending, isError, error } = useClientQuery(id);
  const update = useUpdateClient(id);

  if (!can(membership?.role, 'clients:update')) {
    return <ClientsAccessDenied action="editar clientes" />;
  }

  if (isPending) {
    return (
      <>
        <PageHeader title="Editar cliente" />
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (isError) {
    return <ClientNotFound error={error} />;
  }

  return (
    <>
      <PageHeader title="Editar cliente" description={client.name} />
      <ClientForm
        mode="edit"
        client={client}
        onSubmit={async (values) => {
          const updated = await update.mutateAsync(values);

          toast.success('Cambios guardados.');
          router.replace(`/clients/${updated.id}`);
        }}
      />
    </>
  );
}
