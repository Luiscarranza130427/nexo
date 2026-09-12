'use client';

import { Building2, FolderKanban, ListChecks, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-provider';
import { ROLE_LABELS } from '@/features/auth/permissions';

/**
 * Placeholder for what will become the real dashboard.
 *
 * The tiles show the areas that will hold metrics, with no numbers at all:
 * inventing figures would make the product look finished when it is not.
 */
const UPCOMING = [
  { label: 'Clientes', icon: Building2 },
  { label: 'Proyectos', icon: FolderKanban },
  { label: 'Tareas', icon: ListChecks },
  { label: 'Equipo', icon: Users },
];

export default function DashboardPage() {
  const { user, organization, membership } = useAuth();

  return (
    <>
      <PageHeader
        title={`Bienvenido, ${user?.firstName ?? ''}`.trim()}
        description={
          organization
            ? `Estás trabajando en ${organization.name}${
                membership ? ` como ${ROLE_LABELS[membership.role].toLowerCase()}` : ''
              }.`
            : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nexo está listo</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm text-pretty">
          El entorno, la base de datos y la autenticación están funcionando. Los módulos de negocio
          se irán activando en las próximas fases.
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Próximamente
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {UPCOMING.map((item) => (
            <Card key={item.label} className="border-dashed shadow-none">
              <CardContent className="flex items-center gap-3 py-5">
                <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  <p className="text-muted-foreground text-xs">Sin datos aún</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
