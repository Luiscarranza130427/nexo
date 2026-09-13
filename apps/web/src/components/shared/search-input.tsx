'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SearchInputProps = {
  /** The applied search, usually from the URL. */
  value: string;
  /** Called 350 ms after typing stops. Should be stable. */
  onSearch: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
};

/** A search field that stays responsive while the request it drives is debounced. */
export function SearchInput({ value, onSearch, placeholder, label, className }: SearchInputProps) {
  const [term, setTerm] = useState(value);
  const [synced, setSynced] = useState(value);

  // Follows changes made elsewhere (back button, clearing filters) without an effect.
  if (value !== synced) {
    setSynced(value);
    setTerm(value);
  }

  useEffect(() => {
    if (term === value) {
      return;
    }

    const timer = setTimeout(() => onSearch(term), 350);

    return () => clearTimeout(timer);
  }, [term, value, onSearch]);

  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="pl-9"
      />
    </div>
  );
}
