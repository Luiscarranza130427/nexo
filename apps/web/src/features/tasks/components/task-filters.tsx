'use client';

import type { Priority, TaskStatus } from '@nexo/types';
import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PRIORITIES, PRIORITY_LABELS } from '@/features/projects/labels';
import { TASK_SORT_OPTIONS, TASK_STATUSES, TASK_STATUS_LABELS } from '../labels';

/** Sentinel for "no filter": Radix Select cannot hold an empty string value. */
const ANY = 'ANY';

export type TaskFilterValues = {
  search: string;
  projectId?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  dueFrom?: string;
  dueTo?: string;
};

export type TaskFilterKey = keyof TaskFilterValues;

type Person = { userId: string; firstName: string; lastName: string };

type TaskFiltersProps = {
  values: TaskFilterValues;
  /** Should be stable: the debounced search depends on it. */
  onChange: (key: TaskFilterKey, value: string | undefined) => void;
  onClear: () => void;
  people: Person[];
  /** Offers the signed-in person first, as "Asignadas a mí". */
  currentUserId?: string;
  /** When given, a project filter is shown. */
  projects?: { id: string; code: string; name: string }[];
  /** The board already has a column per status, so only the list filters by it. */
  withStatus?: boolean;
  withDueRange?: boolean;
  sort?: { value: string; onChange: (value: string) => void };
  searchPlaceholder: string;
  actions?: ReactNode;
};

/** Filters shared by the task list and the board. Values live in the URL. */
export function TaskFilters({
  values,
  onChange,
  onClear,
  people,
  currentUserId,
  projects,
  withStatus = false,
  withDueRange = false,
  sort,
  searchPlaceholder,
  actions,
}: TaskFiltersProps) {
  // Local copy so typing stays responsive while the request is debounced.
  const [term, setTerm] = useState(values.search);
  const [syncedSearch, setSyncedSearch] = useState(values.search);

  // Follows URL changes made elsewhere (back button, clearing filters).
  if (values.search !== syncedSearch) {
    setSyncedSearch(values.search);
    setTerm(values.search);
  }

  useEffect(() => {
    if (term === values.search) {
      return;
    }

    const timer = setTimeout(() => onChange('search', term), 350);

    return () => clearTimeout(timer);
  }, [term, values.search, onChange]);

  const hasFilters = Boolean(
    values.search ||
    values.projectId ||
    values.status ||
    values.priority ||
    values.assigneeId ||
    values.dueFrom ||
    values.dueTo,
  );

  const me = people.find((person) => person.userId === currentUserId);
  const others = people.filter((person) => person.userId !== currentUserId);

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
            placeholder={searchPlaceholder}
            aria-label="Buscar tareas"
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
          {actions}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {projects ? (
          <Select
            value={values.projectId ?? ANY}
            onValueChange={(value) => onChange('projectId', value === ANY ? undefined : value)}
          >
            <SelectTrigger className="w-full" aria-label="Filtrar por proyecto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos los proyectos</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <span className="text-muted-foreground font-mono text-xs">{project.code}</span>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {withStatus ? (
          <Select
            value={values.status ?? ANY}
            onValueChange={(value) => onChange('status', value === ANY ? undefined : value)}
          >
            <SelectTrigger className="w-full" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos los estados</SelectItem>
              {TASK_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Select
          value={values.priority ?? ANY}
          onValueChange={(value) => onChange('priority', value === ANY ? undefined : value)}
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
          value={values.assigneeId ?? ANY}
          onValueChange={(value) => onChange('assigneeId', value === ANY ? undefined : value)}
        >
          <SelectTrigger className="w-full" aria-label="Filtrar por responsable">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos los responsables</SelectItem>
            {me ? <SelectItem value={me.userId}>Asignadas a mí</SelectItem> : null}
            {others.map((person) => (
              <SelectItem key={person.userId} value={person.userId}>
                {person.firstName} {person.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {sort ? (
          <Select value={sort.value} onValueChange={sort.onChange}>
            <SelectTrigger className="w-full" aria-label="Ordenar tareas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {withDueRange ? (
          <>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="task-due-from"
                className="text-muted-foreground shrink-0 text-xs font-normal"
              >
                Vence desde
              </Label>
              <Input
                id="task-due-from"
                type="date"
                value={values.dueFrom ?? ''}
                max={values.dueTo}
                onChange={(event) => onChange('dueFrom', event.target.value || undefined)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="task-due-to"
                className="text-muted-foreground shrink-0 text-xs font-normal"
              >
                hasta
              </Label>
              <Input
                id="task-due-to"
                type="date"
                value={values.dueTo ?? ''}
                min={values.dueFrom}
                onChange={(event) => onChange('dueTo', event.target.value || undefined)}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
