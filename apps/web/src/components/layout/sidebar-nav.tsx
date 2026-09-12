'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAVIGATION } from '@/config/navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/features/auth/auth-provider';
import { can } from '@/features/auth/permissions';
import { cn } from '@/lib/utils';

/** Active for the exact route and for anything nested under it. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarNavProps = {
  collapsed?: boolean;
  /** Called after a link is followed, so the mobile drawer can close itself. */
  onNavigate?: () => void;
};

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const { membership } = useAuth();

  return (
    <nav className="flex flex-col gap-6 px-3" aria-label="Navegación principal">
      {NAVIGATION.map((section) => {
        // Options a role cannot use are hidden. UX only — the API still decides.
        const items = section.items.filter(
          (item) => !item.capability || can(membership?.role, item.capability),
        );

        if (items.length === 0) {
          return null;
        }

        return (
          <div key={section.label} className="flex flex-col gap-1">
            {!collapsed ? (
              <p className="text-muted-foreground px-3 pb-1 text-[11px] font-medium tracking-wide uppercase">
                {section.label}
              </p>
            ) : (
              <div className="bg-sidebar-border mx-auto mb-1 h-px w-6" aria-hidden="true" />
            )}

            {items.map((item) => {
              const active = isActive(pathname, item.href);

              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                    'transition-colors duration-150',
                    collapsed && 'justify-center px-0',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                  )}
                >
                  <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  {collapsed ? <span className="sr-only">{item.label}</span> : null}
                </Link>
              );

              // Collapsed icons need a name; a tooltip supplies it on hover and focus.
              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
