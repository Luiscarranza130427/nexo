'use client';

import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/features/auth/auth-provider';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { cn } from '@/lib/utils';

/**
 * Current organization and the caller's role in it.
 *
 * Shows the name, never the id: an identifier means nothing to a person and
 * only clutters the interface.
 */
export function OrganizationSummaryCard({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  const { organization, membership } = useAuth();

  if (!organization) {
    return null;
  }

  if (collapsed) {
    return (
      <div
        className={cn('flex justify-center', className)}
        title={organization.name}
        aria-label={`Organización: ${organization.name}`}
      >
        <span className="bg-sidebar-accent text-sidebar-accent-foreground flex size-8 items-center justify-center rounded-lg">
          <Building2 className="size-4" aria-hidden="true" />
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2.5 overflow-hidden', className)}>
      <span className="bg-sidebar-accent text-sidebar-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Building2 className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sidebar-foreground truncate text-sm font-medium">{organization.name}</p>
        {membership ? (
          <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[10px] font-medium">
            {ROLE_LABELS[membership.role]}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
