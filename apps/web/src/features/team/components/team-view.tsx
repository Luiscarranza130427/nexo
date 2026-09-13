'use client';

import { UserPlus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/features/auth/auth-provider';
import { can } from '@/features/auth/permissions';
import { useUpdateSearchParams } from '@/hooks/use-update-search-params';
import { InvitationsPanel } from './invitations-panel';
import { InviteMemberDialog } from './invite-member-dialog';
import { MembersPanel } from './members-panel';
import { TeamSummaryCards } from './team-summary';

export function TeamView() {
  const { membership } = useAuth();
  const searchParams = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const [invite, setInvite] = useState({ open: false, key: 0 });

  const canManage = can(membership?.role, 'members:manage');
  // Invitations are for whoever manages the team; everyone else always sees members.
  const tab = canManage && searchParams.get('tab') === 'invitations' ? 'invitations' : 'members';

  // A fresh dialog per opening, so no earlier form state or link survives.
  const openInvite = () => setInvite((current) => ({ open: true, key: current.key + 1 }));

  const changeTab = (next: string) =>
    // Each tab has its own filters; carrying them across would mean nothing.
    updateParams({
      tab: next === 'invitations' ? 'invitations' : undefined,
      search: undefined,
      role: undefined,
      status: undefined,
      sortBy: undefined,
      sortOrder: undefined,
    });

  return (
    <>
      <PageHeader
        title="Equipo"
        description="Administra los miembros y accesos de tu organización."
        actions={
          canManage ? (
            <Button onClick={openInvite} className="gap-2">
              <UserPlus className="size-4" aria-hidden="true" />
              Invitar miembro
            </Button>
          ) : undefined
        }
      />

      <TeamSummaryCards />

      {canManage ? (
        <Tabs value={tab} onValueChange={changeTab} className="gap-5">
          <TabsList>
            <TabsTrigger value="members">Miembros</TabsTrigger>
            <TabsTrigger value="invitations">Invitaciones</TabsTrigger>
          </TabsList>
          <TabsContent value="members">
            <MembersPanel />
          </TabsContent>
          <TabsContent value="invitations">
            <InvitationsPanel onInvite={openInvite} />
          </TabsContent>
        </Tabs>
      ) : (
        <MembersPanel />
      )}

      {canManage ? (
        <InviteMemberDialog
          key={invite.key}
          open={invite.open}
          onOpenChange={(open) => setInvite((current) => ({ ...current, open }))}
        />
      ) : null}
    </>
  );
}
