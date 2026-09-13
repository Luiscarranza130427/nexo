'use client';

import { BriefcaseBusiness, ShieldCheck, UserRound, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeamSummaryQuery } from '../hooks/use-team';

/** Real counts from one grouped query. Nothing is shown rather than an invented figure. */
export function TeamSummaryCards() {
  const { data, isPending, isError } = useTeamSummaryQuery();

  if (isError) {
    return null;
  }

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  const cells = [
    { label: 'Miembros', value: data.total, icon: Users },
    {
      label: 'Propietarios y administradores',
      value: data.byRole.OWNER + data.byRole.ADMIN,
      icon: ShieldCheck,
    },
    { label: 'Gestores', value: data.byRole.MANAGER, icon: BriefcaseBusiness },
    { label: 'Colaboradores', value: data.byRole.MEMBER, icon: UserRound },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-card border-border rounded-xl border p-4">
          <dt className="text-muted-foreground flex items-center gap-2 text-xs">
            <cell.icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{cell.label}</span>
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}
