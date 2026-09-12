import type { Metadata } from 'next';
import { FolderKanban } from 'lucide-react';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export const metadata: Metadata = { title: 'Proyectos' };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Proyectos"
      description="El trabajo que entregas, agrupado por cliente."
      icon={FolderKanban}
    />
  );
}
