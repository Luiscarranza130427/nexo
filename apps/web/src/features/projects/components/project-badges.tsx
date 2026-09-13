import type { Priority, ProjectStatus } from '@nexo/types';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Clock,
  Minus,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PRIORITY_LABELS, PROJECT_STATUS_LABELS, dueDateInfo } from '../labels';

/**
 * Colour reinforces every label here, it never replaces it: the text is always
 * present, so status and priority read correctly for colour-blind people and
 * in monochrome.
 */

const STATUS_STYLES: Record<ProjectStatus, string> = {
  PLANNING: 'border-border bg-muted text-muted-foreground',
  ACTIVE: 'border-primary/30 bg-primary/10 text-primary',
  ON_HOLD: 'border-warning/30 bg-warning/10 text-warning',
  COMPLETED: 'border-success/30 bg-success/10 text-success',
  CANCELLED: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant="outline" className={cn('font-medium', STATUS_STYLES[status])}>
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}

/** An icon as well as a word, so priority is legible at a glance without colour. */
const PRIORITY_ICONS: Record<Priority, LucideIcon> = {
  LOW: ChevronDown,
  MEDIUM: Minus,
  HIGH: ChevronUp,
  URGENT: ChevronsUp,
};

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: 'text-muted-foreground',
  MEDIUM: 'text-foreground',
  HIGH: 'border-warning/30 text-warning',
  URGENT: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export function ProjectPriorityBadge({ priority }: { priority: Priority }) {
  const Icon = PRIORITY_ICONS[priority];

  return (
    <Badge variant="outline" className={cn('gap-1 font-medium', PRIORITY_STYLES[priority])}>
      <Icon className="size-3.5" aria-hidden="true" />
      <span>
        <span className="sr-only">Prioridad </span>
        {PRIORITY_LABELS[priority]}
      </span>
    </Badge>
  );
}

const DUE_TONES = {
  overdue: 'text-destructive',
  today: 'text-warning',
  soon: 'text-warning',
  upcoming: 'text-muted-foreground',
} as const;

/** "Vence hoy", "Vence en 3 días", "Vencido hace 2 días". Nothing for finished work. */
export function DueDateIndicator({
  dueDate,
  status,
  className,
}: {
  dueDate: string | null;
  status: ProjectStatus;
  className?: string;
}) {
  const info = dueDateInfo(dueDate, status);

  if (!info) {
    return null;
  }

  const Icon = info.tone === 'overdue' ? TriangleAlert : Clock;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        DUE_TONES[info.tone],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {info.label}
    </span>
  );
}
