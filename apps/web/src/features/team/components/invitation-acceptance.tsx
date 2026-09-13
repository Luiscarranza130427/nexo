'use client';

import type { AcceptedInvitation, InvitationPreview } from '@nexo/types';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, CircleCheck, Clock, LogOut, SearchX, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { EmptyState } from '@/components/shared/empty-state';
import { NexoMark, NovaTecAttribution } from '@/components/shared/nexo-mark';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-provider';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format-date';
import { useInvitationPreview } from '../hooks/use-invitation';
import { ExistingAccountForm, NewAccountForm } from './accept-invitation-form';

type ValidPreview = Extract<InvitationPreview, { valid: true }>;
type SettledPreview = Extract<InvitationPreview, { valid: false }>;

/** Public chrome: no sidebar, no session required. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between p-4">
        <Link href="/login" className="flex items-center gap-2.5">
          <NexoMark />
          <span className="text-base font-semibold tracking-tight">Nexo</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-10">
        <div className="w-full max-w-md space-y-6">{children}</div>
      </main>
      <footer className="px-4 pb-6">
        <NovaTecAttribution className="text-center" />
      </footer>
    </div>
  );
}

const SignInLink = () => (
  <Button asChild variant="outline">
    <Link href="/login">Ir a iniciar sesión</Link>
  </Button>
);

function SettledInvitation({ preview }: { preview: SettledPreview }) {
  const organization = preview.organizationName;
  const states = {
    EXPIRED: {
      icon: Clock,
      title: 'Invitación expirada',
      description: `La invitación a ${organization} ha expirado. Pide a quien te invitó que te envíe una nueva.`,
    },
    REVOKED: {
      icon: Ban,
      title: 'Invitación revocada',
      description: `La invitación a ${organization} fue revocada y ya no puede usarse.`,
    },
    ACCEPTED: {
      icon: CircleCheck,
      title: 'Invitación ya aceptada',
      description: `Esta invitación a ${organization} ya fue aceptada. Si fuiste tú, inicia sesión para entrar.`,
    },
  } as const;
  const state = states[preview.status];

  return (
    <EmptyState
      icon={state.icon}
      title={state.title}
      description={state.description}
      action={<SignInLink />}
    />
  );
}

function ValidInvitation({
  token,
  preview,
  onAccepted,
  onStale,
}: {
  token: string;
  preview: ValidPreview;
  onAccepted: (accepted: AcceptedInvitation, password: string) => Promise<void>;
  onStale: () => void;
}) {
  const { isAuthenticated, user, logout } = useAuth();
  const signedInAsSomeoneElse = isAuthenticated && user?.email !== preview.email;

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Has sido invitado a</p>
          <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">
            {preview.organizationName}
          </h1>
        </div>

        <dl className="bg-card border-border grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
          <div className="space-y-0.5">
            <dt className="text-muted-foreground text-xs">Rol</dt>
            <dd className="font-medium">{ROLE_LABELS[preview.role]}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-muted-foreground text-xs">Expira</dt>
            <dd>{formatDateTime(preview.expiresAt)}</dd>
          </div>
          <div className="space-y-0.5 sm:col-span-2">
            <dt className="text-muted-foreground text-xs">Correo</dt>
            <dd className="break-all">{preview.email}</dd>
          </div>
        </dl>
      </div>

      {signedInAsSomeoneElse ? (
        <div className="space-y-4">
          <Alert>
            <TriangleAlert className="size-4" aria-hidden="true" />
            <AlertDescription>
              Has iniciado sesión como <strong>{user?.email}</strong>, pero esta invitación es para{' '}
              <strong>{preview.email}</strong>. Cierra sesión para continuar.
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => void logout().catch(() => undefined)}
          >
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </Button>
        </div>
      ) : preview.accountExists ? (
        <ExistingAccountForm
          token={token}
          email={preview.email}
          onAccepted={onAccepted}
          onStale={onStale}
        />
      ) : (
        <NewAccountForm
          token={token}
          email={preview.email}
          onAccepted={onAccepted}
          onStale={onStale}
        />
      )}
    </>
  );
}

export function InvitationAcceptance({ token }: { token: string }) {
  const preview = useInvitationPreview(token);
  const { isAuthenticated, isLoading, user, login, switchOrganization } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  /**
   * Enters the organization just joined. A signed-in invitee switches into it
   * through the existing selector flow; anyone else is signed in with the
   * password they just typed, which is used here and dropped.
   */
  const handleAccepted = async (accepted: AcceptedInvitation, password: string) => {
    try {
      if (isAuthenticated && user?.email === accepted.email) {
        await switchOrganization(accepted.organization.id);
      } else {
        await login({
          email: accepted.email,
          password,
          organizationId: accepted.organization.id,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['auth', 'organizations'] });
      toast.success(`Te has unido a ${accepted.organization.name}.`);
      router.replace('/dashboard');
    } catch {
      router.replace('/login?invitation=accepted');
    }
  };

  if (preview.isPending || isLoading) {
    return (
      <Shell>
        <p role="status" className="sr-only">
          Comprobando la invitación…
        </p>
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </Shell>
    );
  }

  if (preview.isError) {
    const missing = preview.error instanceof ApiError && preview.error.status === 404;

    return (
      <Shell>
        {missing ? (
          <EmptyState
            icon={SearchX}
            title="Enlace de invitación no válido"
            description="Revisa que el enlace esté completo o pide a quien te invitó uno nuevo."
            action={<SignInLink />}
          />
        ) : (
          <EmptyState
            icon={TriangleAlert}
            title="No se pudo cargar la invitación"
            description={errorMessage(preview.error)}
            action={
              <Button variant="outline" onClick={() => void preview.refetch()}>
                Reintentar
              </Button>
            }
          />
        )}
      </Shell>
    );
  }

  return (
    <Shell>
      {preview.data.valid ? (
        <ValidInvitation
          token={token}
          preview={preview.data}
          onAccepted={handleAccepted}
          onStale={() => void preview.refetch()}
        />
      ) : (
        <SettledInvitation preview={preview.data} />
      )}
    </Shell>
  );
}
