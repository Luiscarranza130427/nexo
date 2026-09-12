'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const OPTIONS = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const;

/**
 * Light / dark / system switch.
 *
 * The trigger icon is chosen by CSS, not by state: next-themes puts the `dark`
 * class on <html> before React hydrates, so both icons render and the variant
 * hides one. That sidesteps the usual "mounted" flag — and the hydration
 * mismatch it exists to paper over — with no JavaScript at all.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Cambiar tema">
          <Sun className="size-[18px] dark:hidden" aria-hidden="true" />
          <Moon className="hidden size-[18px] dark:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      {/* Only mounted once opened, which is always after hydration. */}
      <DropdownMenuContent align="end" className="w-36">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => setTheme(option.value)}
            aria-current={theme === option.value ? 'true' : undefined}
            className="gap-2"
          >
            <option.icon className="size-4" aria-hidden="true" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
