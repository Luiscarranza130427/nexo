'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { NexoMark } from '@/components/shared/nexo-mark';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { OrganizationSummaryCard } from './organization-summary';
import { SidebarNav } from './sidebar-nav';

/** The same navigation as the desktop sidebar, in a drawer, below `lg`. */
export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú">
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar w-72 p-0">
        {/* Required for assistive technology; the visible title is the wordmark. */}
        <SheetTitle className="sr-only">Navegación</SheetTitle>

        <div className="flex h-16 items-center px-4">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5"
          >
            <NexoMark />
            <span className="text-sidebar-foreground text-base font-semibold tracking-tight">
              Nexo
            </span>
          </Link>
        </div>

        <Separator className="bg-sidebar-border" />

        <div className="flex-1 overflow-y-auto py-4">
          {/* Following a link should dismiss the drawer, not leave it covering the page. */}
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>

        <Separator className="bg-sidebar-border" />

        <div className="p-3">
          <OrganizationSummaryCard />
        </div>
      </SheetContent>
    </Sheet>
  );
}
