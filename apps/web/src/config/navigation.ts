import {
  Building2,
  CalendarDays,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Capability } from '@/features/auth/permissions';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When set, the item is hidden from roles without this capability (UX only). */
  capability?: Capability;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

/** Single source of truth for the sidebar and the breadcrumb labels. */
export const NAVIGATION: NavSection[] = [
  {
    label: 'Principal',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Gestión',
    items: [
      { href: '/clients', label: 'Clientes', icon: Building2 },
      { href: '/projects', label: 'Proyectos', icon: FolderKanban },
      { href: '/tasks', label: 'Tareas', icon: ListChecks },
    ],
  },
  {
    label: 'Organización',
    items: [
      { href: '/team', label: 'Equipo', icon: Users, capability: 'members:manage' },
      { href: '/documents', label: 'Documentos', icon: FileText },
      { href: '/finance', label: 'Finanzas', icon: Wallet, capability: 'organization:manage' },
      { href: '/calendar', label: 'Calendario', icon: CalendarDays },
    ],
  },
  {
    label: 'Sistema',
    items: [{ href: '/settings', label: 'Configuración', icon: Settings }],
  },
];

/** Flat lookup of href → label, used by the breadcrumb. */
export const ROUTE_LABELS: Record<string, string> = Object.fromEntries(
  NAVIGATION.flatMap((section) => section.items.map((item) => [item.href, item.label])),
);
