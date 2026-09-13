import type { InvitationStatus, MembershipRole, UserStatus } from '@nexo/types';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { cn } from '@/lib/utils';
import { INVITATION_STATUS_LABELS, MEMBER_STATUS_LABELS } from '../labels';

/** Colour reinforces every label here, it never replaces it: the text is always present. */

const ROLE_STYLES: Record<MembershipRole, string> = {
  OWNER: 'border-primary/30 bg-primary/10 text-primary',
  ADMIN: 'border-primary/20 text-primary',
  MANAGER: 'border-border bg-muted text-foreground',
  MEMBER: 'border-border text-muted-foreground',
};

export function MemberRoleBadge({ role }: { role: MembershipRole }) {
  return (
    <Badge variant="outline" className={cn('font-medium', ROLE_STYLES[role])}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

const STATUS_STYLES: Record<UserStatus, string> = {
  ACTIVE: 'border-success/30 bg-success/10 text-success',
  INACTIVE: 'border-border bg-muted text-muted-foreground',
  INVITED: 'border-warning/30 bg-warning/10 text-warning',
};

export function MemberStatusBadge({ status }: { status: UserStatus }) {
  return (
    <Badge variant="outline" className={cn('font-medium', STATUS_STYLES[status])}>
      {MEMBER_STATUS_LABELS[status]}
    </Badge>
  );
}

const INVITATION_STYLES: Record<InvitationStatus, string> = {
  PENDING: 'border-warning/30 bg-warning/10 text-warning',
  ACCEPTED: 'border-success/30 bg-success/10 text-success',
  EXPIRED: 'border-border bg-muted text-muted-foreground',
  REVOKED: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  return (
    <Badge variant="outline" className={cn('font-medium', INVITATION_STYLES[status])}>
      {INVITATION_STATUS_LABELS[status]}
    </Badge>
  );
}
