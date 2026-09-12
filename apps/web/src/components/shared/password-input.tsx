'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Password field with a reveal toggle.
 *
 * The toggle is a real button so it is reachable by keyboard, and it only
 * changes `type` — the value is never touched, so revealing cannot corrupt what
 * was typed.
 */
export function PasswordInput({ className, ...props }: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        // Not in the tab order: the toggle is a convenience, and stopping on it
        // between the password field and the submit button is friction.
        tabIndex={-1}
        className={cn(
          'text-muted-foreground hover:text-foreground absolute top-1/2 right-1 -translate-y-1/2',
          'rounded-md p-2 transition-colors duration-150',
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
