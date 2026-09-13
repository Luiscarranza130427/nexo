import type { MembershipRole } from '@nexo/types';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { ROLE_DESCRIPTIONS } from '../labels';

type RoleOptionsProps<T extends MembershipRole> = {
  legend: string;
  name: string;
  roles: readonly T[];
  value: T;
  onChange: (role: T) => void;
  /** Marked as the member's current role. */
  current?: MembershipRole;
};

/**
 * Roles as native radio buttons, each with what it means. Native inputs give
 * arrow-key navigation, labels and screen-reader semantics for free.
 */
export function RoleOptions<T extends MembershipRole>({
  legend,
  name,
  roles,
  value,
  onChange,
  current,
}: RoleOptionsProps<T>) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      {roles.map((role) => (
        <label
          key={role}
          className="border-border hover:bg-accent/40 has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-ring/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-focus-visible:ring-[3px]"
        >
          <input
            type="radio"
            name={name}
            value={role}
            checked={value === role}
            onChange={() => onChange(role)}
            className="accent-primary mt-0.5 size-4 shrink-0"
          />
          <span className="min-w-0 space-y-0.5">
            <span className="block text-sm font-medium">
              {ROLE_LABELS[role]}
              {role === current ? (
                <span className="text-muted-foreground font-normal"> · rol actual</span>
              ) : null}
            </span>
            <span className="text-muted-foreground block text-xs">{ROLE_DESCRIPTIONS[role]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
