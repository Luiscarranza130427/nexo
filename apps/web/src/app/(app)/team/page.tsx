import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export const metadata: Metadata = { title: 'Equipo' };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Equipo"
      description="Personas, roles y disponibilidad de tu organización."
      icon={Users}
    />
  );
}
