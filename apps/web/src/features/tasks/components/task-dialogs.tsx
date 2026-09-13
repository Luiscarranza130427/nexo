'use client';

import type { TaskDetail } from '@nexo/types';
import { useState } from 'react';
import { toast } from 'sonner';
import { useLoadTask } from '../hooks/use-tasks';
import { taskErrorMessage } from '../task-errors';
import { TaskDeleteDialog, type DeletableTask } from './task-delete-dialog';
import { TaskDetailSheet } from './task-detail-sheet';
import { TaskFormDialog, type TaskFormOptions } from './task-form-dialog';

/**
 * The detail sheet, the form and the delete confirmation, shared by the task
 * list and the board. The sheet and the form keep their last content while
 * they animate closed, so nothing blanks out mid-transition.
 */
export function useTaskDialogs() {
  const loadTask = useLoadTask();
  const [detail, setDetail] = useState<{ id: string | null; open: boolean }>({
    id: null,
    open: false,
  });
  const [form, setForm] = useState<{ options: TaskFormOptions; open: boolean }>({
    options: {},
    open: false,
  });
  const [deleting, setDeleting] = useState<DeletableTask | null>(null);

  const openEdit = (task: TaskDetail) => setForm({ options: { task }, open: true });

  return {
    detail,
    form,
    deleting,
    openDetail: (id: string) => setDetail({ id, open: true }),
    closeDetail: () => setDetail((current) => ({ ...current, open: false })),
    openCreate: (options: Omit<TaskFormOptions, 'task'> = {}) => setForm({ options, open: true }),
    openEdit,
    /** A row or a card only carries the summary; the form also needs the description. */
    editById: async (id: string) => {
      try {
        openEdit(await loadTask(id));
      } catch (error) {
        toast.error(taskErrorMessage(error));
      }
    },
    closeForm: () => setForm((current) => ({ ...current, open: false })),
    openDelete: (task: DeletableTask) => setDeleting(task),
    closeDelete: () => setDeleting(null),
  };
}

export type TaskDialogsState = ReturnType<typeof useTaskDialogs>;

export function TaskDialogs({
  state,
  showBoardLink,
}: {
  state: TaskDialogsState;
  showBoardLink?: boolean;
}) {
  return (
    <>
      <TaskDetailSheet
        taskId={state.detail.id}
        open={state.detail.open}
        onClose={state.closeDetail}
        onEdit={state.openEdit}
        onDelete={state.openDelete}
        showBoardLink={showBoardLink}
      />

      <TaskFormDialog
        {...state.form.options}
        open={state.form.open}
        onOpenChange={(open) => {
          if (!open) {
            state.closeForm();
          }
        }}
      />

      <TaskDeleteDialog
        task={state.deleting}
        open={state.deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            state.closeDelete();
          }
        }}
        onDeleted={state.closeDetail}
      />
    </>
  );
}
