import type { Metadata } from 'next';
import { MemberDetailView } from '@/features/team/components/member-detail-view';

export const metadata: Metadata = { title: 'Miembro' };

export default async function TeamMemberPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  return <MemberDetailView userId={userId} />;
}
