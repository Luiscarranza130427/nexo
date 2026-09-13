import type { Metadata } from 'next';
import { NewProjectView } from '@/features/projects/components/project-views';

export const metadata: Metadata = { title: 'Nuevo proyecto' };

export default function NewProjectPage() {
  return <NewProjectView />;
}
