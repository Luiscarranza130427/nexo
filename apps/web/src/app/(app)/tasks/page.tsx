import type { Metadata } from 'next';
import { ListChecks } from 'lucide-react';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export const metadata: Metadata = { title: 'Tareas' };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Tareas"
      description="Las unidades de trabajo del día a día dentro de cada proyecto."
      icon={ListChecks}
    />
  );
}
