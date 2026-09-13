import { AccessDenied } from '@/components/shared/access-denied';

/** Shown when a role reaches a clients page it cannot use. */
export function ClientsAccessDenied({ action }: { action: string }) {
  return <AccessDenied action={action} backHref="/clients" backLabel="Volver a clientes" />;
}
