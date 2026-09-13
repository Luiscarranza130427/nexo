'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { TaskAssignee, TaskDetail, TaskStatus } from '@nexo/types';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/auth-provider';
import { can } from '@/features/auth/permissions';
import { useProjectMembersQuery, useProjectsQuery } from '@/features/projects/hooks/use-projects';
import { PRIORITIES, PRIORITY_LABELS, toDateInputValue } from '@/features/projects/labels';
import { useCreateTask, useUpdateTask } from '../hooks/use-tasks';
import { TASK_STATUSES, TASK_STATUS_LABELS } from '../labels';
import { taskSchema, type TaskFormOutput, type TaskFormValues } from '../schemas/task-schema';
import { errorCodeOf, taskErrorMessage } from '../task-errors';

/** Radix Select cannot hold an empty value, so "unassigned" uses a sentinel. */
const UNASSIGNED = 'NONE';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Server rules that belong to one field are shown on that field. */
const FIELD_ERRORS: Partial<Record<string, 'projectId' | 'assigneeId' | 'dueDate'>> = {
  TASK_PROJECT_NOT_FOUND: 'projectId',
  TASK_ASSIGNEE_NOT_FOUND: 'assigneeId',
  TASK_ASSIGNEE_NOT_PROJECT_MEMBER: 'assigneeId',
  INVALID_TASK_DATES: 'dueDate',
};

export type TaskFormOptions = {
  /** The task being edited. Without it the dialog creates one. */
  task?: TaskDetail;
  /** Fixes the project of a new task and hides the picker (board, project page). */
  projectId?: string;
  /** Preselects a project in the picker, e.g. from a filtered list. */
  defaultProjectId?: string;
  /** The column a new task starts in when created from the board. */
  defaultStatus?: TaskStatus;
};

type TaskFormDialogProps = TaskFormOptions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (task: TaskDetail) => void;
};

export function TaskFormDialog({ open, onOpenChange, onSaved, ...options }: TaskFormDialogProps) {
  const { task } = options;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{task ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          <DialogDescription>
            {task
              ? `${task.project.code} · ${task.project.name}`
              : 'Se añade al final de su columna en el tablero del proyecto.'}
          </DialogDescription>
        </DialogHeader>

        {/* The content unmounts when the dialog closes, so each opening starts fresh. */}
        <TaskForm
          {...options}
          onCancel={() => onOpenChange(false)}
          onSaved={(saved) => {
            onOpenChange(false);
            onSaved?.(saved);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-2">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive mt-1.5 text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground mt-1.5 text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function TaskForm({
  task,
  projectId,
  defaultProjectId,
  defaultStatus,
  onCancel,
  onSaved,
}: TaskFormOptions & { onCancel: () => void; onSaved: (task: TaskDetail) => void }) {
  const { membership } = useAuth();
  const create = useCreateTask();
  const update = useUpdateTask();
  const [formError, setFormError] = useState<string | null>(null);

  // Reassigning is for managers; a MEMBER edits their own task but keeps it.
  const canReassign = can(membership?.role, 'tasks:manage');
  const fixedProject = task?.project.id ?? projectId;

  const form = useForm<TaskFormValues, unknown, TaskFormOutput>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      projectId: fixedProject ?? defaultProjectId ?? '',
      title: task?.title ?? '',
      description: task?.description ?? '',
      status: task?.status ?? defaultStatus ?? 'TODO',
      priority: task?.priority ?? 'MEDIUM',
      assigneeId: task?.assignee?.userId ?? '',
      startDate: toDateInputValue(task?.startDate ?? null),
      dueDate: toDateInputValue(task?.dueDate ?? null),
    },
  });

  const selectedProject = useWatch({ control: form.control, name: 'projectId' });
  const hasProject = UUID.test(selectedProject);
  const projects = useProjectsQuery(
    { limit: 100, sortBy: 'code', sortOrder: 'asc' },
    !fixedProject,
  );
  const members = useProjectMembersQuery(selectedProject, hasProject);

  // Only project members can be assigned. Someone since removed from the
  // project stays selectable on a task that is still assigned to them.
  const assigneeOptions: TaskAssignee[] = (members.data ?? []).map(
    ({ userId, firstName, lastName, avatarUrl }) => ({ userId, firstName, lastName, avatarUrl }),
  );

  if (
    task?.assignee &&
    !assigneeOptions.some((person) => person.userId === task.assignee?.userId)
  ) {
    assigneeOptions.unshift(task.assignee);
  }

  const assigneeHint = !canReassign
    ? 'Solo un gestor puede cambiar el responsable.'
    : hasProject && members.isSuccess && members.data.length === 0
      ? 'Este proyecto aún no tiene miembros. Añádelos desde su página para asignar tareas.'
      : 'Solo pueden asignarse miembros del proyecto.';

  const { errors, isSubmitting } = form.formState;

  const handleSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    const { projectId: chosenProject, assigneeId, ...fields } = values;

    try {
      const saved = task
        ? await update.mutateAsync({
            id: task.id,
            input: canReassign ? { ...fields, assigneeId } : fields,
          })
        : await create.mutateAsync({ projectId: chosenProject, ...fields, assigneeId });

      toast.success(task ? 'Cambios guardados.' : 'Tarea creada.');
      onSaved(saved);
    } catch (error) {
      const field = FIELD_ERRORS[errorCodeOf(error) ?? ''];

      // A hidden project field cannot show its own error.
      if (field && !(field === 'projectId' && fixedProject)) {
        form.setError(field, { message: taskErrorMessage(error) });

        return;
      }

      setFormError(taskErrorMessage(error));
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {fixedProject ? null : (
        <Field id="task-project" label="Proyecto" error={errors.projectId?.message}>
          <Controller
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  // Assignees belong to a project; a new project starts unassigned.
                  form.setValue('assigneeId', '');
                }}
              >
                <SelectTrigger
                  id="task-project"
                  className="w-full"
                  aria-invalid={errors.projectId ? true : undefined}
                  aria-describedby={errors.projectId ? 'task-project-error' : undefined}
                >
                  <SelectValue placeholder="Elige un proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.data?.data.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <span className="text-muted-foreground font-mono text-xs">
                        {project.code}
                      </span>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      )}

      <Field id="task-title" label="Título" error={errors.title?.message}>
        <Input
          id="task-title"
          placeholder="Preparar la propuesta de diseño"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? 'task-title-error' : undefined}
          {...form.register('title')}
        />
      </Field>

      <Field id="task-description" label="Descripción" error={errors.description?.message}>
        <Textarea
          id="task-description"
          rows={4}
          placeholder="Qué hay que hacer y cualquier contexto útil."
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? 'task-description-error' : undefined}
          {...form.register('description')}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="task-status" label="Estado" error={errors.status?.message}>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="task-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {TASK_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field id="task-priority" label="Prioridad" error={errors.priority?.message}>
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="task-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field
          id="task-assignee"
          label="Responsable"
          error={errors.assigneeId?.message}
          hint={assigneeHint}
          className="sm:col-span-2"
        >
          <Controller
            control={form.control}
            name="assigneeId"
            render={({ field }) => (
              <Select
                value={field.value ? field.value : UNASSIGNED}
                onValueChange={(value) => field.onChange(value === UNASSIGNED ? '' : value)}
                disabled={!canReassign || !hasProject}
              >
                <SelectTrigger
                  id="task-assignee"
                  className="w-full"
                  aria-invalid={errors.assigneeId ? true : undefined}
                  aria-describedby={
                    errors.assigneeId ? 'task-assignee-error' : 'task-assignee-hint'
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
                  {assigneeOptions.map((person) => (
                    <SelectItem key={person.userId} value={person.userId}>
                      {person.firstName} {person.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field id="task-start" label="Inicio" error={errors.startDate?.message}>
          <Input
            id="task-start"
            type="date"
            aria-invalid={errors.startDate ? true : undefined}
            aria-describedby={errors.startDate ? 'task-start-error' : undefined}
            {...form.register('startDate')}
          />
        </Field>

        <Field id="task-due" label="Vencimiento" error={errors.dueDate?.message}>
          <Input
            id="task-due"
            type="date"
            aria-invalid={errors.dueDate ? true : undefined}
            aria-describedby={errors.dueDate ? 'task-due-error' : undefined}
            {...form.register('dueDate')}
          />
        </Field>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        {/* isSubmitting also guards against a double submit. */}
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {task ? 'Guardar cambios' : 'Crear tarea'}
        </Button>
      </DialogFooter>
    </form>
  );
}
