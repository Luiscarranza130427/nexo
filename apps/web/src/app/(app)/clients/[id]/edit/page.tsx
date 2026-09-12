import type { Metadata } from 'next';
import { EditClientView } from '@/features/clients/components/edit-client-view';

export const metadata: Metadata = { title: 'Editar cliente' };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <EditClientView id={id} />;
}
