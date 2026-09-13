'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { ProjectDetail } from '@nexo/types';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useClientsQuery } from '@/features/clients/hooks/use-clients';
import { ApiError, errorMessage } from '@/lib/api/errors';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  toDateInputValue,
} from '../labels';
import {
  projectSchema,
  type ProjectFormOutput,
  type ProjectFormValues,
} from '../schemas/project-schema';

/** Radix Select cannot hold an empty value, so "no client" uses a sentinel. */
const NO_CLIENT = 'NONE';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-5 md:grid-cols-3">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
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
      ) : null}
    </div>
  );
}

type ProjectFormProps = {
  mode: 'create' | 'edit';
  project?: ProjectDetail;
  onSubmit: (values: ProjectFormOutput) => Promise<void>;
};

/**
 * One form for create and edit. There is no code field: the API assigns the
 * code on creation and it never changes afterwards.
 */
export function ProjectForm({ mode, project, onSubmit }: ProjectFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const { data: clients } = useClientsQuery({ limit: 100, sortBy: 'name', sortOrder: 'asc' });

  // The current client must stay selectable even if it falls outside the first 100.
  const clientOptions = [...(clients?.data ?? [])];

  if (project?.client && !clientOptions.some((client) => client.id === project.client?.id)) {
    clientOptions.unshift({ ...project.client } as (typeof clientOptions)[number]);
  }

  const form = useForm<ProjectFormValues, unknown, ProjectFormOutput>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      clientId: project?.client?.id ?? '',
      status: project?.status ?? 'PLANNING',
      priority: project?.priority ?? 'MEDIUM',
      startDate: toDateInputValue(project?.startDate ?? null),
      dueDate: toDateInputValue(project?.dueDate ?? null),
    },
  });

  const { errors, isSubmitting } = form.formState;

  const handleSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      await onSubmit(values);
    } catch (error) {
      const code =
        error instanceof ApiError ? String((error.body as { code?: string })?.code ?? '') : '';

      // Server rules that map to one field are shown on that field.
      if (code === 'PROJECT_CLIENT_NOT_FOUND') {
        form.setError('clientId', { message: 'Ese cliente ya no está disponible.' });

        return;
      }

      if (code === 'INVALID_PROJECT_DATES') {
        form.setError('dueDate', {
          message: 'La fecha de vencimiento no puede ser anterior a la de inicio.',
        });
        form.setFocus('dueDate');

        return;
      }

      setFormError(errorMessage(error));
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Section title="Información general" description="Qué es este proyecto y para qué existe.">
        <Field id="name" label="Nombre" error={errors.name?.message} className="sm:col-span-2">
          <Input
            id="name"
            placeholder="Portal de clientes"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'name-error' : undefined}
            {...form.register('name')}
          />
        </Field>

        <Field
          id="description"
          label="Descripción"
          error={errors.description?.message}
          className="sm:col-span-2"
        >
          <Textarea
            id="description"
            rows={4}
            placeholder="Alcance, objetivos y cualquier contexto útil para el equipo."
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? 'description-error' : undefined}
            {...form.register('description')}
          />
        </Field>
      </Section>

      <Separator />

      <Section title="Cliente" description="Opcional. Los proyectos internos no tienen cliente.">
        <Field
          id="clientId"
          label="Cliente"
          error={errors.clientId?.message}
          className="sm:col-span-2"
        >
          <Controller
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <Select
                value={field.value ? field.value : NO_CLIENT}
                onValueChange={(value) => field.onChange(value === NO_CLIENT ? '' : value)}
              >
                <SelectTrigger id="clientId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>Sin cliente</SelectItem>
                  {clientOptions.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </Section>

      <Separator />

      <Section title="Estado y prioridad" description="Dónde está el proyecto y cuánto urge.">
        <Field id="status" label="Estado" error={errors.status?.message}>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {PROJECT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field id="priority" label="Prioridad" error={errors.priority?.message}>
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="priority" className="w-full">
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
      </Section>

      <Separator />

      <Section
        title="Fechas"
        description="Opcionales. El vencimiento no puede ser anterior al inicio."
      >
        <Field id="startDate" label="Inicio" error={errors.startDate?.message}>
          <Input
            id="startDate"
            type="date"
            aria-invalid={errors.startDate ? true : undefined}
            aria-describedby={errors.startDate ? 'startDate-error' : undefined}
            {...form.register('startDate')}
          />
        </Field>

        <Field id="dueDate" label="Vencimiento" error={errors.dueDate?.message}>
          <Input
            id="dueDate"
            type="date"
            aria-invalid={errors.dueDate ? true : undefined}
            aria-describedby={errors.dueDate ? 'dueDate-error' : undefined}
            {...form.register('dueDate')}
          />
        </Field>
      </Section>

      <Separator />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" asChild disabled={isSubmitting}>
          <Link href={mode === 'edit' && project ? `/projects/${project.id}` : '/projects'}>
            Cancelar
          </Link>
        </Button>
        {/* isSubmitting also guards against a double submit. */}
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {mode === 'create' ? 'Crear proyecto' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}
