'use client';

import type { Client, ClientSortField, SortOrder } from '@nexo/types';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CLIENT_TYPE_LABELS, formatDate } from '../labels';
import { ClientStatusBadge } from './client-status-badge';

type Permissions = {
  canUpdate: boolean;
  canDelete: boolean;
};

type ClientsTableProps = {
  clients: Client[];
  sortBy: ClientSortField;
  sortOrder: SortOrder;
  onSort: (field: ClientSortField) => void;
  onDelete: (client: Client) => void;
  permissions: Permissions;
};

/** A sortable column header. It is a real button, so keyboard users can sort too. */
function SortableHead({
  field,
  label,
  sortBy,
  sortOrder,
  onSort,
  className,
}: {
  field: ClientSortField;
  label: string;
  sortBy: ClientSortField;
  sortOrder: SortOrder;
  onSort: (field: ClientSortField) => void;
  className?: string;
}) {
  const active = sortBy === field;
  const Icon = !active ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown;

  return (
    <TableHead
      className={className}
      aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'hover:text-foreground -mx-2 flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors duration-150',
          active && 'text-foreground',
        )}
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    </TableHead>
  );
}

/** Row actions, filtered by role. A MEMBER only ever sees "Ver". */
function RowActions({
  client,
  permissions,
  onDelete,
}: {
  client: Client;
  permissions: Permissions;
  onDelete: (client: Client) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Acciones para ${client.name}`}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem asChild>
          <Link href={`/clients/${client.id}`} className="gap-2">
            <Eye className="size-4" aria-hidden="true" />
            Ver
          </Link>
        </DropdownMenuItem>
        {permissions.canUpdate ? (
          <DropdownMenuItem asChild>
            <Link href={`/clients/${client.id}/edit`} className="gap-2">
              <Pencil className="size-4" aria-hidden="true" />
              Editar
            </Link>
          </DropdownMenuItem>
        ) : null}
        {permissions.canDelete ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onDelete(client);
            }}
            className="text-destructive focus:text-destructive gap-2"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Eliminar
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Document type and number, or a dash when the client has neither. */
function DocumentCell({ client }: { client: Client }) {
  if (!client.documentNumber && !client.documentType) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="text-sm">
      {client.documentType ? (
        <span className="text-muted-foreground mr-1.5 text-xs font-medium">
          {client.documentType}
        </span>
      ) : null}
      {client.documentNumber ?? '—'}
    </span>
  );
}

function ContactCell({ client }: { client: Client }) {
  if (!client.email && !client.phone) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col gap-0.5 text-sm">
      {client.email ? (
        <a
          href={`mailto:${client.email}`}
          className="hover:text-primary truncate transition-colors"
        >
          {client.email}
        </a>
      ) : null}
      {client.phone ? (
        <a
          href={`tel:${client.phone.replace(/\s/g, '')}`}
          className="text-muted-foreground hover:text-primary truncate text-xs transition-colors"
        >
          {client.phone}
        </a>
      ) : null}
    </div>
  );
}

export function ClientsTable({
  clients,
  sortBy,
  sortOrder,
  onSort,
  onDelete,
  permissions,
}: ClientsTableProps) {
  return (
    <>
      {/* Desktop: a real table, with semantics assistive technology understands. */}
      <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                field="name"
                label="Cliente"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
              <TableHead>Tipo</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Estado</TableHead>
              <SortableHead
                field="createdAt"
                label="Creado"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
              <SortableHead
                field="updatedAt"
                label="Actualizado"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
                className="hidden lg:table-cell"
              />
              <TableHead className="w-12">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/clients/${client.id}`}
                    className="hover:text-primary transition-colors"
                  >
                    {client.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {CLIENT_TYPE_LABELS[client.type]}
                </TableCell>
                <TableCell>
                  <DocumentCell client={client} />
                </TableCell>
                <TableCell className="max-w-52">
                  <ContactCell client={client} />
                </TableCell>
                <TableCell>
                  <ClientStatusBadge status={client.status} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {formatDate(client.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm whitespace-nowrap lg:table-cell">
                  {formatDate(client.updatedAt)}
                </TableCell>
                <TableCell>
                  <RowActions client={client} permissions={permissions} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards instead of a table squeezed sideways. Works from 320px. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {clients.map((client) => (
          <li
            key={client.id}
            className="border-border bg-card flex items-start gap-3 rounded-xl border p-4"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/clients/${client.id}`}
                  className="hover:text-primary min-w-0 font-medium transition-colors"
                >
                  <span className="block truncate">{client.name}</span>
                </Link>
                <ClientStatusBadge status={client.status} />
              </div>

              <p className="text-muted-foreground text-xs">
                {CLIENT_TYPE_LABELS[client.type]}
                {client.documentNumber
                  ? ` · ${client.documentType ?? ''} ${client.documentNumber}`
                  : ''}
              </p>

              <ContactCell client={client} />

              <p className="text-muted-foreground text-xs">
                Creado el {formatDate(client.createdAt)}
              </p>
            </div>

            <RowActions client={client} permissions={permissions} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </>
  );
}
