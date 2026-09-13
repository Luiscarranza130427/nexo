'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ROUTE_LABELS } from '@/config/navigation';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Action pages below a list or a record, which the navigation does not list. */
const SEGMENT_LABELS: Record<string, string> = {
  new: 'Nuevo',
  edit: 'Editar',
  board: 'Tablero',
};

type RecordLabelSource = { code?: string; name?: string; firstName?: string; lastName?: string };

/** A project reads as its code, a client as its name, a person as their full name. */
function recordLabel(record: RecordLabelSource | undefined): string {
  if (record?.code) {
    return record.code;
  }

  if (record?.name) {
    return record.name;
  }

  if (record?.firstName) {
    return `${record.firstName} ${record.lastName ?? ''}`.trim();
  }

  return 'Detalle';
}

/** Turns an unknown segment into something readable: `my-page` → `My page`. */
function humanize(segment: string): string {
  const spaced = segment.replace(/-/g, ' ');

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Breadcrumb derived from the URL, so nested routes work without extra wiring.
 *
 * A record id in the path would otherwise render as a raw UUID. Instead it is
 * resolved from the query cache using the module's own key convention
 * (`[resource, 'detail', id]`), which every feature follows. A record with a
 * human-readable `code` (projects: NEX-001) is labelled by it, otherwise by `name` — so this stays
 * generic and does not import anything from a specific module. `enabled: false`
 * means it only ever reads the cache: it subscribes to updates but never fetches.
 */
export function NavBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const idIndex = segments.findIndex((segment) => UUID.test(segment));
  const resource = idIndex > 0 ? segments[idIndex - 1] : undefined;
  const recordId = idIndex >= 0 ? segments[idIndex] : undefined;

  const { data: record } = useQuery<RecordLabelSource>({
    queryKey: resource && recordId ? [resource, 'detail', recordId] : ['__no-record__'],
    enabled: false,
  });

  if (segments.length === 0) {
    return null;
  }

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const known = ROUTE_LABELS[href];

    if (known) {
      return { href, label: known };
    }

    if (index === idIndex) {
      return { href, label: recordLabel(record) };
    }

    return { href, label: SEGMENT_LABELS[segment] ?? humanize(segment) };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;

          return (
            <Fragment key={crumb.href}>
              <BreadcrumbItem>
                {last ? (
                  <BreadcrumbPage className="max-w-40 truncate sm:max-w-none">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={crumb.href} className="max-w-32 truncate sm:max-w-none">
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!last ? <BreadcrumbSeparator /> : null}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
