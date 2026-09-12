'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { NexoMark } from '@/components/shared/nexo-mark';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { OrganizationSummaryCard } from './organization-summary';
import { SidebarNav } from './sidebar-nav';
import { useSidebarCollapsed } from '@/hooks/use-sidebar-state';
import { cn } from '@/lib/utils';

/**
 * Desktop sidebar.
 *
 * Hidden below `lg`, where the same navigation is served by a drawer from the
 * header instead.
 */
export function AppSidebar() {
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <aside
      className={cn(
        'bg-sidebar border-sidebar-border hidden shrink-0 flex-col border-r lg:flex',
        'transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      <div
        className={cn('flex h-16 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-md"
          aria-label="Nexo, ir al dashboard"
        >
          <NexoMark />
          {!collapsed ? (
            <span className="text-sidebar-foreground text-base font-semibold tracking-tight">
              Nexo
            </span>
          ) : null}
        </Link>
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav collapsed={collapsed} />
      </div>

      <Separator className="bg-sidebar-border" />

      <div className={cn('space-y-3 p-3', collapsed && 'px-2')}>
        <OrganizationSummaryCard collapsed={collapsed} />
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
          className={cn(
            'text-muted-foreground w-full justify-start gap-2',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          ) : (
            <>
              <PanelLeftClose className="size-4" aria-hidden="true" />
              <span>Contraer</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
