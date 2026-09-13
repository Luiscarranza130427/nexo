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
import { useDeleteTask } from '../hooks/use-tasks';
import { errorCodeOf, taskErrorMessage } from '../task-errors';

export type DeletableTask = { id: string; title: string; project: { id: string } };

export function TaskDeleteDialog({
  task,
  open,
  onOpenChange,
  onDeleted,
}: {
  task: DeletableTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const remove = useDeleteTask();
  const [error, setError] = useState<string | null>(null);

  if (!task) {
    return null;
  }

  const handleDelete = async () => {
    setError(null);

    try {
      await remove.mutateAsync({ id: task.id, projectId: task.project.id });
      toast.success('Tarea eliminada.');
      onOpenChange(false);
      onDeleted?.();
    } catch (cause) {
      // Stays open and says why: closing on failure would suggest it worked.
      setError(
        errorCodeOf(cause) === 'FORBIDDEN'
          ? 'No tienes permisos para eliminar tareas.'
          : taskErrorMessage(cause),
      );
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
          <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará <strong className="text-foreground break-words">{task.title}</strong>. Esta
            acción no puede deshacerse.
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
