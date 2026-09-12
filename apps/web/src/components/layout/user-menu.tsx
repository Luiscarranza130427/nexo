'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, Check, LogOut, Settings, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/auth-provider';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { fetchOrganizations } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api/errors';

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function UserMenu() {
  const { user, organization, membership, logout, switchOrganization, isAuthenticated } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  /**
   * Fetched only so the menu knows whether a switcher is worth showing. Cached
   * for five minutes because memberships change rarely.
   */
  const { data: organizations = [] } = useQuery({
    queryKey: ['auth', 'organizations'],
    queryFn: fetchOrganizations,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    setBusy(true);

    try {
      await logout();
      toast.success('Sesión cerrada.');
      router.replace('/login');
    } finally {
      setBusy(false);
    }
  };

  const handleSwitch = async (organizationId: string) => {
    if (organizationId === organization?.id) {
      return;
    }

    setBusy(true);

    try {
      await switchOrganization(organizationId);
      toast.success('Organización cambiada.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 px-1.5"
          aria-label={`Cuenta de ${user.firstName} ${user.lastName}`}
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {initials(user.firstName, user.lastName)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
            {user.firstName}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
          {organization ? (
            <p className="text-muted-foreground mt-1.5 truncate text-xs">
              {organization.name}
              {membership ? ` · ${ROLE_LABELS[membership.role]}` : null}
            </p>
          ) : null}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/settings" className="gap-2">
              <User className="size-4" aria-hidden="true" />
              Perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings" className="gap-2">
              <Settings className="size-4" aria-hidden="true" />
              Configuración
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {/* A switcher only makes sense when there is somewhere to switch to. */}
        {organizations.length > 1 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Cambiar organización
            </DropdownMenuLabel>
            {organizations.map((item) => {
              const current = item.id === organization?.id;

              return (
                <DropdownMenuItem
                  key={item.id}
                  disabled={busy}
                  onSelect={(event) => {
                    event.preventDefault();
                    void handleSwitch(item.id);
                  }}
                  className="gap-2"
                >
                  <Building2 className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{item.name}</span>
                  {current ? (
                    <Check className="text-primary size-4 shrink-0" aria-label="Actual" />
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={busy}
          onSelect={(event) => {
            event.preventDefault();
            void handleLogout();
          }}
          className="text-destructive focus:text-destructive gap-2"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
