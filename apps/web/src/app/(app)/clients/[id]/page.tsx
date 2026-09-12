import type { Metadata } from 'next';
import { ClientDetailView } from '@/features/clients/components/client-detail-view';

export const metadata: Metadata = { title: 'Cliente' };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <ClientDetailView id={id} />;
}
