import { Construction, type LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';

type ModulePlaceholderProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
};

/**
 * Every not-yet-built module renders this.
 *
 * One honest "in construction" state instead of eight pages of fake tables:
 * nothing here pretends to be functionality that does not exist.
 */
export function ModulePlaceholder({ title, description, icon }: ModulePlaceholderProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon ?? Construction}
        title="Módulo en construcción"
        description="Esta sección se activará en una fase posterior del desarrollo."
      />
    </>
  );
}
