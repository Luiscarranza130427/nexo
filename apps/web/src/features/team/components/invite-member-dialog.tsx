'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { CreatedInvitation } from '@nexo/types';
import { Check, Copy, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { useAuth } from '@/features/auth/auth-provider';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { errorCodeOf } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format-date';
import { useCreateInvitation } from '../hooks/use-team';
import { invitableRolesFor } from '../permissions';
import { inviteSchema, type InviteFormValues } from '../schemas/invite-schema';
import { teamErrorMessage } from '../team-errors';
import { RoleOptions } from './role-options';

type InviteMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Creates an invitation and shows its link once. The API keeps only a
 * fingerprint, so the link cannot be shown again: it lives in this dialog's
 * state and is dropped as soon as the dialog has closed.
 */
export function InviteMemberDialog({ open, onOpenChange }: InviteMemberDialogProps) {
  const [created, setCreated] = useState<CreatedInvitation | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        onCloseAutoFocus={() => setCreated(null)}
      >
        {created ? (
          <InvitationCreated invitation={created} onClose={() => onOpenChange(false)} />
        ) : (
          <InviteForm onCreated={setCreated} onCancel={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function InviteForm({
  onCreated,
  onCancel,
}: {
  onCreated: (invitation: CreatedInvitation) => void;
  onCancel: () => void;
}) {
  const { membership } = useAuth();
  const create = useCreateInvitation();
  const [formError, setFormError] = useState<string | null>(null);
  const roles = invitableRolesFor(membership?.role);

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'MEMBER' },
  });

  const { errors, isSubmitting } = form.formState;

  const handleSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      onCreated(await create.mutateAsync(values));
    } catch (error) {
      const code = errorCodeOf(error);

      // Both are about the address, so they belong on the address.
      if (code === 'USER_ALREADY_MEMBER' || code === 'INVITATION_ALREADY_PENDING') {
        form.setError('email', { message: teamErrorMessage(error) });

        return;
      }

      setFormError(teamErrorMessage(error));
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <DialogHeader>
        <DialogTitle>Invitar miembro</DialogTitle>
        <DialogDescription>
          Crearás un enlace de invitación para compartir. Nexo todavía no envía correos.
        </DialogDescription>
      </DialogHeader>

      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="invite-email">Correo electrónico</Label>
        <Input
          id="invite-email"
          type="email"
          autoComplete="off"
          placeholder="persona@empresa.com"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'invite-email-error' : undefined}
          {...form.register('email')}
        />
        {errors.email ? (
          <p id="invite-email-error" role="alert" className="text-destructive text-sm">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <Controller
        control={form.control}
        name="role"
        render={({ field }) => (
          <RoleOptions
            legend="Rol"
            name={field.name}
            roles={roles}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        {/* isSubmitting also guards against a double submit. */}
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Crear invitación
        </Button>
      </DialogFooter>
    </form>
  );
}

function InvitationCreated({
  invitation,
  onClose,
}: {
  invitation: CreatedInvitation;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invitation.inviteUrl);
      setCopied(true);
      toast.success('Enlace copiado.');
    } catch {
      toast.error('No se pudo copiar. Selecciona el enlace y cópialo manualmente.');
    }
  };

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle>Invitación creada</DialogTitle>
        <DialogDescription>
          Comparte este enlace con la persona invitada. Por seguridad solo se muestra ahora: si se
          pierde, revoca la invitación y crea otra.
        </DialogDescription>
      </DialogHeader>

      <dl className="border-border grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <div className="space-y-0.5 sm:col-span-2">
          <dt className="text-muted-foreground text-xs">Correo</dt>
          <dd className="font-medium break-all">{invitation.email}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-muted-foreground text-xs">Rol</dt>
          <dd>{ROLE_LABELS[invitation.role]}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-muted-foreground text-xs">Expira</dt>
          <dd>{formatDateTime(invitation.expiresAt)}</dd>
        </div>
      </dl>

      <div className="space-y-2">
        <Label htmlFor="invite-link">Enlace de invitación</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="invite-link"
            readOnly
            value={invitation.inviteUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="font-mono text-xs"
          />
          <Button type="button" onClick={copy} className="shrink-0 gap-2">
            {copied ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied ? 'Copiado' : 'Copiar enlace'}
          </Button>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </DialogFooter>
    </div>
  );
}
