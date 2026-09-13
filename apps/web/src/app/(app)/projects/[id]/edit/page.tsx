import type { Metadata } from 'next';
import { EditProjectView } from '@/features/projects/components/project-views';

export const metadata: Metadata = { title: 'Editar proyecto' };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <EditProjectView id={id} />;
}
