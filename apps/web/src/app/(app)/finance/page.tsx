import type { Metadata } from 'next';
import { Wallet } from 'lucide-react';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export const metadata: Metadata = { title: 'Finanzas' };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Finanzas"
      description="Presupuestos, facturas y seguimiento de cobros."
      icon={Wallet}
    />
  );
}
