import type { ClientStatus } from '@nexo/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CLIENT_STATUS_LABELS } from '../labels';

/**
 * Colour reinforces the label, it never replaces it: the status is always
 * readable as text, so it works for colour-blind readers and in monochrome.
 */
const STYLES: Record<ClientStatus, string> = {
  ACTIVE: 'border-success/30 bg-success/10 text-success',
  PROSPECT: 'border-warning/30 bg-warning/10 text-warning',
  INACTIVE: 'border-border bg-muted text-muted-foreground',
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return (
    <Badge variant="outline" className={cn('font-medium', STYLES[status])}>
      {CLIENT_STATUS_LABELS[status]}
    </Badge>
  );
}
