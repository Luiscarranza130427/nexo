'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Client } from '@nexo/types';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
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
import { ApiError, errorMessage } from '@/lib/api/errors';
import { CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from '../labels';
import {
  DOCUMENT_TYPES,
  clientSchema,
  type ClientFormOutput,
  type ClientFormValues,
} from '../schemas/client-schema';

/** A labelled section of the form, so a long form still reads as a few short ones. */
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
      <div className="space-y-1 md:col-span-1">
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

type ClientFormProps = {
  mode: 'create' | 'edit';
  client?: Client;
  onSubmit: (values: ClientFormOutput) => Promise<void>;
};

/**
 * One form for both create and edit.
 *
 * The only differences are the defaults and the submit label, so there is no
 * reason for two near-identical components to drift apart.
 */
export function ClientForm({ mode, client, onSubmit }: ClientFormProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ClientFormValues, unknown, ClientFormOutput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      type: client?.type ?? 'COMPANY',
      name: client?.name ?? '',
      status: client?.status ?? 'PROSPECT',
      documentType: client?.documentType ?? '',
      documentNumber: client?.documentNumber ?? '',
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      address: client?.address ?? '',
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

      if (code === 'CLIENT_DOCUMENT_ALREADY_EXISTS') {
        // Attach it to the offending field rather than to the form as a whole.
        form.setError('documentNumber', {
          message: 'Ya existe un cliente con este número de documento.',
        });
        form.setFocus('documentNumber');

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

      <Section
        title="Información principal"
        description="Cómo identificarás a este cliente dentro de Nexo."
      >
        <Field id="type" label="Tipo" error={errors.type?.message}>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

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
                  {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field id="name" label="Nombre" error={errors.name?.message} className="sm:col-span-2">
          <Input
            id="name"
            placeholder="Acme SAC"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'name-error' : undefined}
            {...form.register('name')}
          />
        </Field>
      </Section>

      <Separator />

      <Section title="Identificación" description="Documento fiscal o de identidad. Opcional.">
        <Field id="documentType" label="Tipo de documento" error={errors.documentType?.message}>
          <Controller
            control={form.control}
            name="documentType"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="documentType" className="w-full">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field id="documentNumber" label="Número" error={errors.documentNumber?.message}>
          <Input
            id="documentNumber"
            placeholder="20123456789"
            aria-invalid={errors.documentNumber ? true : undefined}
            aria-describedby={errors.documentNumber ? 'documentNumber-error' : undefined}
            {...form.register('documentNumber')}
          />
        </Field>
      </Section>

      <Separator />

      <Section title="Contacto" description="Cómo comunicarte con este cliente.">
        <Field id="email" label="Correo electrónico" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            placeholder="contacto@empresa.com"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...form.register('email')}
          />
        </Field>

        <Field id="phone" label="Teléfono" error={errors.phone?.message}>
          <Input id="phone" placeholder="+51 999 888 777" {...form.register('phone')} />
        </Field>
      </Section>

      <Separator />

      <Section title="Ubicación" description="Dirección fiscal o de operaciones.">
        <Field
          id="address"
          label="Dirección"
          error={errors.address?.message}
          className="sm:col-span-2"
        >
          <Input
            id="address"
            placeholder="Av. Javier Prado 123, Lima"
            {...form.register('address')}
          />
        </Field>
      </Section>

      <Separator />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" asChild disabled={isSubmitting}>
          <Link href={mode === 'edit' && client ? `/clients/${client.id}` : '/clients'}>
            Cancelar
          </Link>
        </Button>
        {/* isSubmitting also guards against a double submit. */}
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {mode === 'create' ? 'Crear cliente' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}
