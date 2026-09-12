'use client';

import type { ClientStatus, ClientType } from '@nexo/types';
import { Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from '../labels';

/** Sentinel for "no filter": Radix Select cannot hold an empty string value. */
const ANY = 'ANY';

export type ClientsFilters = {
  search: string;
  status: ClientStatus | undefined;
  type: ClientType | undefined;
};

type ClientsToolbarProps = {
  filters: ClientsFilters;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: ClientStatus | undefined) => void;
  onTypeChange: (type: ClientType | undefined) => void;
  onClear: () => void;
  canCreate: boolean;
};

export function ClientsToolbar({
  filters,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onClear,
  canCreate,
}: ClientsToolbarProps) {
  // Local copy so typing stays responsive while the request is debounced.
  const [term, setTerm] = useState(filters.search);
  const [syncedSearch, setSyncedSearch] = useState(filters.search);

  // Keeps the box in step when the URL changes from elsewhere (back button,
  // clearing filters) without fighting the user mid-keystroke. Adjusting state
  // during render is React's documented answer here — an effect would cause a
  // second render pass for no reason.
  if (filters.search !== syncedSearch) {
    setSyncedSearch(filters.search);
    setTerm(filters.search);
  }

  useEffect(() => {
    if (term === filters.search) {
      return;
    }

    const timer = setTimeout(() => onSearchChange(term), 350);

    return () => clearTimeout(timer);
  }, [term, filters.search, onSearchChange]);

  const hasFilters =
    filters.search !== '' || filters.status !== undefined || filters.type !== undefined;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar por nombre, correo, teléfono o documento"
          aria-label="Buscar clientes"
          className="pl-9"
        />
      </div>

      <Select
        value={filters.status ?? ANY}
        onValueChange={(value) =>
          onStatusChange(value === ANY ? undefined : (value as ClientStatus))
        }
      >
        <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por estado">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Todos los estados</SelectItem>
          {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.type ?? ANY}
        onValueChange={(value) => onTypeChange(value === ANY ? undefined : (value as ClientType))}
      >
        <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por tipo">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Todos los tipos</SelectItem>
          {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button variant="ghost" onClick={onClear} className="gap-2">
          <X className="size-4" aria-hidden="true" />
          Limpiar
        </Button>
      ) : null}

      {canCreate ? (
        <Button asChild className="gap-2 sm:ml-auto">
          <Link href="/clients/new">
            <Plus className="size-4" aria-hidden="true" />
            Nuevo cliente
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
