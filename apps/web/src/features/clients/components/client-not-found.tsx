import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { ApiError, errorMessage } from '@/lib/api/errors';

/**
 * A client that does not exist and one that belongs to another organization are
 * indistinguishable here — the API answers 404 for both, on purpose.
 */
export function ClientNotFound({ error }: { error: unknown }) {
  const missing = error instanceof ApiError && error.status === 404;

  return (
    <EmptyState
      icon={SearchX}
      title={missing ? 'Cliente no encontrado' : 'No se pudo cargar el cliente'}
      description={
        missing
          ? 'Este cliente no existe o ya no está disponible en tu organización.'
          : errorMessage(error)
      }
      action={
        <Button asChild variant="outline">
          <Link href="/clients">Volver a clientes</Link>
        </Button>
      }
    />
  );
}
