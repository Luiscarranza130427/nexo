import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export const metadata: Metadata = { title: 'Documentos' };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Documentos"
      description="Archivos y referencias asociados a clientes y proyectos."
      icon={FileText}
    />
  );
}
