import type { TaskStatus } from '@nexo/types';
import { Badge } from '@/components/ui/badge';
import { DueDateBadge } from '@/features/projects/components/project-badges';
import { cn } from '@/lib/utils';
import { TASK_STATUS_LABELS, taskDueDateInfo } from '../labels';

/** Priority is one enum shared with projects, so it keeps one badge. */
export { ProjectPriorityBadge as TaskPriorityBadge } from '@/features/projects/components/project-badges';

/** Colour reinforces the label, never replaces it. */
const STATUS_STYLES: Record<TaskStatus, string> = {
  TODO: 'border-border bg-muted text-muted-foreground',
  IN_PROGRESS: 'border-primary/30 bg-primary/10 text-primary',
  IN_REVIEW: 'border-warning/30 bg-warning/10 text-warning',
  DONE: 'border-success/30 bg-success/10 text-success',
  CANCELLED: 'border-destructive/30 bg-destructive/10 text-destructive',
};

/** A small dot in the same tone, for column headers. */
export const STATUS_DOTS: Record<TaskStatus, string> = {
  TODO: 'bg-muted-foreground/60',
  IN_PROGRESS: 'bg-primary',
  IN_REVIEW: 'bg-warning',
  DONE: 'bg-success',
  CANCELLED: 'bg-destructive',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className={cn('font-medium', STATUS_STYLES[status])}>
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

/** "Vence hoy", "Vencido hace 2 días". Nothing once the task is done or cancelled. */
export function TaskDueDate({
  dueDate,
  status,
  className,
}: {
  dueDate: string | null;
  status: TaskStatus;
  className?: string;
}) {
  const info = taskDueDateInfo(dueDate, status);

  return info ? <DueDateBadge info={info} className={className} /> : null;
}
