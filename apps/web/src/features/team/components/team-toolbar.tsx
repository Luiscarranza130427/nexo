'use client';

import type { MembershipRole, UserStatus } from '@nexo/types';
import { X } from 'lucide-react';
import { useCallback } from 'react';
import { SearchInput } from '@/components/shared/search-input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLE_LABELS } from '@/features/auth/permissions';
import {
  MEMBERSHIP_ROLES,
  MEMBER_STATUS_LABELS,
  TEAM_SORT_OPTIONS,
  USER_STATUSES,
} from '../labels';

/** Sentinel for "no filter": Radix Select cannot hold an empty string value. */
const ANY = 'ANY';

export type TeamFilterKey = 'search' | 'role' | 'status';

type TeamToolbarProps = {
  values: { search: string; role?: MembershipRole; status?: UserStatus };
  sort: string;
  /** Should be stable: the debounced search depends on it. */
  onChange: (key: TeamFilterKey, value: string | undefined) => void;
  onSortChange: (value: string) => void;
  onClear: () => void;
};

export function TeamToolbar({ values, sort, onChange, onSortChange, onClear }: TeamToolbarProps) {
  const onSearch = useCallback((search: string) => onChange('search', search), [onChange]);
  const hasFilters = Boolean(values.search || values.role || values.status);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <SearchInput
        value={values.search}
        onSearch={onSearch}
        placeholder="Buscar por nombre o correo"
        label="Buscar miembros"
        className="lg:max-w-sm lg:flex-1"
      />

      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 lg:flex lg:items-center">
        <Select
          value={values.role ?? ANY}
          onValueChange={(value) => onChange('role', value === ANY ? undefined : value)}
        >
          <SelectTrigger className="w-full lg:w-44" aria-label="Filtrar por rol">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos los roles</SelectItem>
            {MEMBERSHIP_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={values.status ?? ANY}
          onValueChange={(value) => onChange('status', value === ANY ? undefined : value)}
        >
          <SelectTrigger className="w-full lg:w-40" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos los estados</SelectItem>
            {USER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {MEMBER_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="w-full lg:w-52" aria-label="Ordenar miembros">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEAM_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters ? (
        <Button variant="ghost" onClick={onClear} className="gap-2 lg:ml-auto">
          <X className="size-4" aria-hidden="true" />
          Limpiar filtros
        </Button>
      ) : null}
    </div>
  );
}
