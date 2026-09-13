'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AcceptedInvitation } from '@nexo/types';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { PasswordInput } from '@/components/shared/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorCodeOf } from '@/lib/api/errors';
import { useAcceptInvitation } from '../hooks/use-invitation';
import {
  PASSWORD_MIN_LENGTH,
  existingAccountSchema,
  newAccountSchema,
  type ExistingAccountValues,
  type NewAccountValues,
} from '../schemas/accept-invitation-schema';
import { teamErrorMessage } from '../team-errors';

/** The invitation changed while the form was open: the page should show its new state. */
const STALE_CODES = new Set([
  'INVITATION_NOT_FOUND',
  'INVITATION_EXPIRED',
  'INVITATION_REVOKED',
  'INVITATION_ALREADY_ACCEPTED',
  'INVITATION_ACCOUNT_CHANGED',
]);

type AcceptFormProps = {
  token: string;
  email: string;
  /** Gets the password only to sign in right away; nothing keeps it. */
  onAccepted: (accepted: AcceptedInvitation, password: string) => Promise<void>;
  onStale: () => void;
};

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-destructive text-sm">
      {message}
    </p>
  ) : null;
}

function InvitedEmail({ email }: { email: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="accept-email">Correo electrónico</Label>
      <Input
        id="accept-email"
        type="email"
        value={email}
        readOnly
        aria-describedby="accept-email-hint"
        className="bg-muted/50"
      />
      <p id="accept-email-hint" className="text-muted-foreground text-xs">
        La invitación es para este correo y no puede cambiarse.
      </p>
    </div>
  );
}

/** A person without an account creates one; the password is used once and never stored. */
export function NewAccountForm({ token, email, onAccepted, onStale }: AcceptFormProps) {
  const accept = useAcceptInvitation(token);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<NewAccountValues>({
    resolver: zodResolver(newAccountSchema),
    defaultValues: { firstName: '', lastName: '', password: '', confirmPassword: '' },
  });

  const { errors, isSubmitting } = form.formState;

  const handleSubmit = form.handleSubmit(async ({ firstName, lastName, password }) => {
    setFormError(null);

    try {
      const accepted = await accept.mutateAsync({ firstName, lastName, password });

      await onAccepted(accepted, password);
    } catch (error) {
      const code = errorCodeOf(error);

      if (code === 'INVALID_PASSWORD') {
        form.setError('password', { message: teamErrorMessage(error) });

        return;
      }

      if (code && STALE_CODES.has(code)) {
        onStale();
      }

      setFormError(teamErrorMessage(error));
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Crea tu cuenta</h2>
        <p className="text-muted-foreground text-sm">
          Así podrás entrar a Nexo con este correo y una contraseña.
        </p>
      </div>

      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="accept-first-name">Nombre</Label>
          <Input
            id="accept-first-name"
            autoComplete="given-name"
            aria-invalid={errors.firstName ? true : undefined}
            aria-describedby={errors.firstName ? 'accept-first-name-error' : undefined}
            {...form.register('firstName')}
          />
          <FieldError id="accept-first-name-error" message={errors.firstName?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accept-last-name">Apellidos</Label>
          <Input
            id="accept-last-name"
            autoComplete="family-name"
            aria-invalid={errors.lastName ? true : undefined}
            aria-describedby={errors.lastName ? 'accept-last-name-error' : undefined}
            {...form.register('lastName')}
          />
          <FieldError id="accept-last-name-error" message={errors.lastName?.message} />
        </div>
      </div>

      <InvitedEmail email={email} />

      <div className="space-y-2">
        <Label htmlFor="accept-password">Contraseña</Label>
        <PasswordInput
          id="accept-password"
          autoComplete="new-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? 'accept-password-error' : 'accept-password-hint'}
          {...form.register('password')}
        />
        {errors.password ? (
          <FieldError id="accept-password-error" message={errors.password.message} />
        ) : (
          <p id="accept-password-hint" className="text-muted-foreground text-xs">
            Mínimo {PASSWORD_MIN_LENGTH} caracteres. Una frase larga es más segura y fácil de
            recordar.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="accept-confirm-password">Repite la contraseña</Label>
        <PasswordInput
          id="accept-confirm-password"
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={errors.confirmPassword ? 'accept-confirm-password-error' : undefined}
          {...form.register('confirmPassword')}
        />
        <FieldError id="accept-confirm-password-error" message={errors.confirmPassword?.message} />
      </div>

      <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Crear cuenta y unirme
      </Button>
    </form>
  );
}

/**
 * A person who already has an account proves it with their password. Holding
 * the link alone never adds anyone to an organization as an existing person.
 */
export function ExistingAccountForm({ token, email, onAccepted, onStale }: AcceptFormProps) {
  const accept = useAcceptInvitation(token);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ExistingAccountValues>({
    resolver: zodResolver(existingAccountSchema),
    defaultValues: { password: '' },
  });

  const { errors, isSubmitting } = form.formState;

  const handleSubmit = form.handleSubmit(async ({ password }) => {
    setFormError(null);

    try {
      const accepted = await accept.mutateAsync({ password });

      await onAccepted(accepted, password);
    } catch (error) {
      const code = errorCodeOf(error);

      if (code === 'INVALID_CREDENTIALS') {
        form.setError('password', { message: teamErrorMessage(error) });

        return;
      }

      if (code && STALE_CODES.has(code)) {
        onStale();
      }

      setFormError(teamErrorMessage(error));
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Ya tienes una cuenta en Nexo.</h2>
        <p className="text-muted-foreground text-sm">
          Inicia sesión con tu contraseña para aceptar la invitación. No necesitas crear otra.
        </p>
      </div>

      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <InvitedEmail email={email} />

      <div className="space-y-2">
        <Label htmlFor="accept-existing-password">Contraseña</Label>
        <PasswordInput
          id="accept-existing-password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? 'accept-existing-password-error' : undefined}
          {...form.register('password')}
        />
        <FieldError id="accept-existing-password-error" message={errors.password?.message} />
      </div>

      <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Iniciar sesión y unirme
      </Button>
    </form>
  );
}
