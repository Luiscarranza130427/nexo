'use client';

import type { Priority, ProjectStatus } from '@nexo/types';
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
import { useClientsQuery } from '@/features/clients/hooks/use-clients';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  PROJECT_SORT_OPTIONS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
} from '../labels';

/** Sentinel for "no filter": Radix Select cannot hold an empty string value. */
const ANY = 'ANY';

export type ProjectsFilters = {
  search: string;
  status: ProjectStatus | undefined;
  priority: Priority | undefined;
  clientId: string | undefined;
};

type ProjectsToolbarProps = {
  filters: ProjectsFilters;
  sort: string;
  canCreate: boolean;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: ProjectStatus | undefined) => void;
  onPriorityChange: (priority: Priority | undefined) => void;
  onClientChange: (clientId: string | undefined) => void;
  onSortChange: (sort: string) => void;
  onClear: () => void;
};

export function ProjectsToolbar({
  filters,
  sort,
  canCreate,
  onSearchChange,
  onStatusChange,
  onPriorityChange,
  onClientChange,
  onSortChange,
  onClear,
}: ProjectsToolbarProps) {
  // Local copy so typing stays responsive while the request is debounced.
  const [term, setTerm] = useState(filters.search);
  const [syncedSearch, setSyncedSearch] = useState(filters.search);

  // Follows URL changes made elsewhere (back button, clearing filters).
  // Adjusting state during render avoids a second render pass from an effect.
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

  /**
   * Client options reuse the clients module's own query, capped at the API
   * maximum of 100 and sorted by name. An organization with more clients than
   * that will need a searchable picker; that is not the case today.
   */
  const { data: clients } = useClientsQuery({ limit: 100, sortBy: 'name', sortOrder: 'asc' });

  const hasFilters = Boolean(
    filters.search || filters.status || filters.priority || filters.clientId,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar por nombre, código o descripción"
            aria-label="Buscar proyectos"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          {hasFilters ? (
            <Button variant="ghost" onClick={onClear} className="gap-2">
              <X className="size-4" aria-hidden="true" />
              Limpiar
            </Button>
          ) : null}

          {canCreate ? (
            <Button asChild className="flex-1 gap-2 sm:flex-none">
              <Link href="/projects/new">
                <Plus className="size-4" aria-hidden="true" />
                Nuevo proyecto
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <Select
          value={filters.status ?? ANY}
          onValueChange={(value) =>
            onStatusChange(value === ANY ? undefined : (value as ProjectStatus))
          }
        >
          <SelectTrigger className="w-full" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos los estados</SelectItem>
            {PROJECT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {PROJECT_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.priority ?? ANY}
          onValueChange={(value) =>
            onPriorityChange(value === ANY ? undefined : (value as Priority))
          }
        >
          <SelectTrigger className="w-full" aria-label="Filtrar por prioridad">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todas las prioridades</SelectItem>
            {PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.clientId ?? ANY}
          onValueChange={(value) => onClientChange(value === ANY ? undefined : value)}
        >
          <SelectTrigger className="w-full" aria-label="Filtrar por cliente">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos los clientes</SelectItem>
            {clients?.data.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="w-full" aria-label="Ordenar proyectos">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
