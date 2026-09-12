'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { OrganizationSummary } from '@nexo/types';
import { Building2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { PasswordInput } from '@/components/shared/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/auth-provider';
import { loginSchema, type LoginFormValues } from '@/features/auth/login-schema';
import { errorMessage, organizationChoices } from '@/lib/api/errors';

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [choices, setChoices] = useState<OrganizationSummary[] | null>(null);
  /**
   * Held only for the length of this flow.
   *
   * The API needs the credentials again alongside the chosen organization. They
   * live in component state and are dropped the moment the sign-in completes —
   * never written to storage, never sent anywhere else.
   */
  const [pending, setPending] = useState<LoginFormValues | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const { isSubmitting } = form.formState;

  async function attempt(values: LoginFormValues, organizationId?: string) {
    setFormError(null);

    try {
      await login({ ...values, ...(organizationId ? { organizationId } : {}) });
      setPending(null);
      router.replace('/dashboard');
    } catch (error) {
      const organizations = organizationChoices(error);

      if (organizations && organizations.length > 0) {
        // Credentials were accepted; only the organization is missing.
        setChoices(organizations);
        setPending(values);

        return;
      }

      setChoices(null);
      setPending(null);
      setFormError(errorMessage(error));
    }
  }

  if (choices && pending) {
    return (
      <OrganizationPicker
        organizations={choices}
        busy={isSubmitting}
        error={formError}
        onSelect={(organizationId) => attempt(pending, organizationId)}
        onCancel={() => {
          setChoices(null);
          setPending(null);
          form.reset();
        }}
      />
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit((values) => attempt(values))}
      className="space-y-5"
      noValidate
    >
      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="tu@empresa.com"
          aria-invalid={form.formState.errors.email ? true : undefined}
          aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
          {...form.register('email')}
        />
        {form.formState.errors.email ? (
          <p id="email-error" role="alert" className="text-destructive text-sm">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          aria-invalid={form.formState.errors.password ? true : undefined}
          aria-describedby={form.formState.errors.password ? 'password-error' : undefined}
          {...form.register('password')}
        />
        {form.formState.errors.password ? (
          <p id="password-error" role="alert" className="text-destructive text-sm">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      {/* `isSubmitting` also guards against a double submit. */}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Iniciando sesión…
          </>
        ) : (
          'Iniciar sesión'
        )}
      </Button>
    </form>
  );
}

type OrganizationPickerProps = {
  organizations: OrganizationSummary[];
  busy: boolean;
  error: string | null;
  onSelect: (organizationId: string) => void;
  onCancel: () => void;
};

/** Shown when the account belongs to several organizations. */
function OrganizationPicker({
  organizations,
  busy,
  error,
  onSelect,
  onCancel,
}: OrganizationPickerProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Selecciona una organización</h2>
        <p className="text-muted-foreground text-sm">
          Tu cuenta tiene acceso a varias organizaciones. Elige con cuál quieres trabajar.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ul className="space-y-2">
        {organizations.map((organization) => (
          <li key={organization.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSelect(organization.id)}
              className="border-border hover:border-primary/50 hover:bg-accent focus-visible:border-primary flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-150 disabled:opacity-60"
            >
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Building2 className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{organization.name}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {organization.slug}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Button type="button" variant="ghost" className="w-full" onClick={onCancel} disabled={busy}>
        Usar otra cuenta
      </Button>
    </div>
  );
}
