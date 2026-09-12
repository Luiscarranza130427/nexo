'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { useAuth } from '@/features/auth/auth-provider';
import { can } from '@/features/auth/permissions';
import { useCreateClient } from '../hooks/use-clients';
import { ClientForm } from './client-form';
import { ClientsAccessDenied } from './clients-access-denied';

export function NewClientView() {
  const { membership } = useAuth();
  const router = useRouter();
  const create = useCreateClient();

  // UX only — the API rejects the POST regardless of what is rendered here.
  if (!can(membership?.role, 'clients:create')) {
    return <ClientsAccessDenied action="crear clientes" />;
  }

  return (
    <>
      <PageHeader
        title="Nuevo cliente"
        description="Registra una persona o empresa con la que trabaja tu organización."
      />
      <ClientForm
        mode="create"
        onSubmit={async (values) => {
          const client = await create.mutateAsync(values);

          toast.success(`Cliente "${client.name}" creado.`);
          // Straight to the detail view: the next thing you want is to see it.
          router.replace(`/clients/${client.id}`);
        }}
      />
    </>
  );
}
