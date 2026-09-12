'use client';

import { FolderKanban, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { can } from '@/features/auth/permissions';
import { CLIENT_TYPE_LABELS, formatDateTime } from '../labels';
import { useClientQuery } from '../hooks/use-clients';
import { ClientNotFound } from './client-not-found';
import { ClientStatusBadge } from './client-status-badge';
import { DeleteClientDialog } from './delete-client-dialog';

/** One labelled value. Renders an em dash when the field is empty. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-sm">{children ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export function ClientDetailView({ id }: { id: string }) {
  const { membership } = useAuth();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const { data: client, isPending, isError, error } = useClientQuery(id);

  const role = membership?.role;
  const canUpdate = can(role, 'clients:update');
  const canDelete = can(role, 'clients:delete');

  if (isPending) {
    return (
      <>
        <PageHeader title="Cliente" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </>
    );
  }

  if (isError) {
    return <ClientNotFound error={error} />;
  }

  return (
    <>
      <PageHeader
        title={client.name}
        description={CLIENT_TYPE_LABELS[client.type]}
        actions={
          <>
            {canUpdate ? (
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/clients/${client.id}/edit`}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Editar
                </Link>
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="outline"
                onClick={() => setDeleting(true)}
                className="text-destructive hover:text-destructive gap-2"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Eliminar
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Información</CardTitle>
          <ClientStatusBadge status={client.status} />
        </CardHeader>
        <CardContent>
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Tipo">{CLIENT_TYPE_LABELS[client.type]}</Detail>
            <Detail label="Documento">
              {client.documentNumber
                ? `${client.documentType ? `${client.documentType} ` : ''}${client.documentNumber}`
                : null}
            </Detail>
            <Detail label="Correo electrónico">
              {client.email ? (
                <a href={`mailto:${client.email}`} className="hover:text-primary transition-colors">
                  {client.email}
                </a>
              ) : null}
            </Detail>
            <Detail label="Teléfono">
              {client.phone ? (
                <a
                  href={`tel:${client.phone.replace(/\s/g, '')}`}
                  className="hover:text-primary transition-colors"
                >
                  {client.phone}
                </a>
              ) : null}
            </Detail>
            <Detail label="Dirección">{client.address}</Detail>
            <Detail label="Creado">{formatDateTime(client.createdAt)}</Detail>
            <Detail label="Última actualización">{formatDateTime(client.updatedAt)}</Detail>
          </dl>
        </CardContent>
      </Card>

      {/*
        The section exists so the shape of the page is already right, but it
        shows no numbers and no rows: projects arrive in phase 7, and inventing
        any of it would misrepresent what the product does today.
      */}
      <Card className="border-dashed shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderKanban className="text-muted-foreground size-4" aria-hidden="true" />
            Proyectos
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm text-pretty">
          Los proyectos de este cliente se mostrarán aquí.
        </CardContent>
      </Card>

      <DeleteClientDialog
        client={client}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => router.replace('/clients')}
      />
    </>
  );
}
