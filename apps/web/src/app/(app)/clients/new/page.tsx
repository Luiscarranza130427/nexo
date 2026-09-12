import type { Metadata } from 'next';
import { NewClientView } from '@/features/clients/components/new-client-view';

export const metadata: Metadata = { title: 'Nuevo cliente' };

export default function NewClientPage() {
  return <NewClientView />;
}
