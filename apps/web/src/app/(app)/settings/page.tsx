import type { Metadata } from 'next';
import { Settings } from 'lucide-react';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export const metadata: Metadata = { title: 'Configuración' };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Configuración"
      description="Ajustes de tu cuenta y de la organización."
      icon={Settings}
    />
  );
}
