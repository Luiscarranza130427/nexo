'use client';

import type { Client } from '@nexo/types';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ApiError } from '@/lib/api/errors';
import { useDeleteClient } from '../hooks/use-clients';

/** Codes this dialog explains in its own words rather than as a generic failure. */
const MESSAGES: Record<string, string> = {
  CLIENT_HAS_PROJECTS:
    'No se puede eliminar este cliente porque tiene proyectos asociados. Puedes marcarlo como inactivo.',
  CLIENT_NOT_FOUND: 'Este cliente ya no existe.',
  FORBIDDEN: 'No tienes permisos para eliminar clientes.',
};

export function DeleteClientDialog({
  client,
  open,
  onOpenChange,
  onDeleted,
}: {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const remove = useDeleteClient();
  const [error, setError] = useState<string | null>(null);

  if (!client) {
    return null;
  }

  const handleDelete = async () => {
    setError(null);

    try {
      await remove.mutateAsync(client.id);
      toast.success(`Cliente "${client.name}" eliminado.`);
      onOpenChange(false);
      onDeleted?.();
    } catch (cause) {
      // The dialog stays open and says why. Closing silently on failure would
      // leave people believing the client was deleted.
      const code = cause instanceof ApiError ? String((cause.body as { code?: string })?.code) : '';

      setError(MESSAGES[code] ?? 'No se pudo eliminar el cliente. Inténtalo de nuevo.');
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
        }

        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará <strong className="text-foreground">{client.name}</strong>. Esta acción no
            se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={remove.isPending}
            onClick={(event) => {
              // Keeps the dialog mounted so an error can be shown in place.
              event.preventDefault();
              void handleDelete();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {remove.isPending ? 'Eliminando…' : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
