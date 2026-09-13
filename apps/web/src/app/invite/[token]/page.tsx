import type { Metadata } from 'next';
import { InvitationAcceptance } from '@/features/team/components/invitation-acceptance';

export const metadata: Metadata = {
  title: 'Invitación',
  // The token is part of the URL: never pass it on as a referrer, never index it.
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

/** Public, outside the authenticated shell: an invitee usually has no account yet. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return <InvitationAcceptance token={token} />;
}
