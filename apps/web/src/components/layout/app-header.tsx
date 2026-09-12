'use client';

import { Bell, Search } from 'lucide-react';
import { NavBreadcrumb } from './nav-breadcrumb';
import { MobileSidebar } from './mobile-sidebar';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { Button } from '@/components/ui/button';

export function AppHeader() {
  return (
    <header className="bg-background/80 border-border sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-sm sm:px-6">
      <MobileSidebar />

      <div className="min-w-0 flex-1">
        <NavBreadcrumb />
      </div>

      <div className="flex items-center gap-1">
        {/*
          Search and notifications are not built yet. They are rendered disabled
          rather than faked: a control that looks live but does nothing is worse
          than one that plainly says it is coming.
        */}
        <Button
          variant="ghost"
          size="sm"
          disabled
          title="La búsqueda llegará en una fase posterior"
          className="text-muted-foreground hidden gap-2 md:inline-flex"
        >
          <Search className="size-4" aria-hidden="true" />
          <span>Buscar…</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled
          aria-label="Notificaciones (próximamente)"
          title="Las notificaciones llegarán en una fase posterior"
        >
          <Bell className="size-[18px]" aria-hidden="true" />
        </Button>

        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
