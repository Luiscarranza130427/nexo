import type { Metadata } from 'next';
import { CalendarDays } from 'lucide-react';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export const metadata: Metadata = { title: 'Calendario' };

export default function Page() {
  return (
    <ModulePlaceholder
      title="Calendario"
      description="Fechas límite, reuniones e hitos del equipo."
      icon={CalendarDays}
    />
  );
}
