'use client';

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
import { useDeleteProject } from '../hooks/use-projects';

/** Codes this dialog explains in its own words. */
const MESSAGES: Record<string, string> = {
  PROJECT_HAS_TASKS:
    'No se puede eliminar este proyecto porque tiene tareas. Puedes marcarlo como cancelado o completado.',
  PROJECT_NOT_FOUND: 'Este proyecto ya no existe.',
  FORBIDDEN: 'No tienes permisos para eliminar proyectos.',
};

type DeletableProject = { id: string; code: string; name: string };

export function ProjectDeleteDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: {
  project: DeletableProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const remove = useDeleteProject();
  const [error, setError] = useState<string | null>(null);

  if (!project) {
    return null;
  }

  const handleDelete = async () => {
    setError(null);

    try {
      await remove.mutateAsync(project.id);
      toast.success(`Proyecto ${project.code} eliminado.`);
      onOpenChange(false);
      onDeleted?.();
    } catch (cause) {
      // Stays open and says why: closing on failure would suggest it worked.
      const code = cause instanceof ApiError ? String((cause.body as { code?: string })?.code) : '';

      setError(MESSAGES[code] ?? 'No se pudo eliminar el proyecto. Inténtalo de nuevo.');
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
          <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará <strong className="text-foreground">{project.name}</strong>{' '}
            <span className="font-mono text-xs">({project.code})</span>. Esta acción no puede
            deshacerse.
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
