import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export const metadata: Metadata = { title: 'Clientes' };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Clientes"
      description="Empresas y contactos con los que trabaja tu equipo."
      icon={Building2}
    />
  );
}
