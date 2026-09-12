import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';

/** Shown when a role reaches a page it cannot use, instead of a blank screen. */
export function ClientsAccessDenied({ action }: { action: string }) {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="No tienes permisos"
      description={`Tu rol actual no permite ${action}. Habla con un administrador de tu organización.`}
      action={
        <Button asChild variant="outline">
          <Link href="/clients">Volver a clientes</Link>
        </Button>
      }
    />
  );
}
