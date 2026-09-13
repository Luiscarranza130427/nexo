/**
 * Serializes a list query for a URL.
 *
 * Empty values are dropped, so the URL stays clean and two equivalent filter
 * states — `search: ''` and no search at all — produce the same cache key.
 */
export function toQueryString(query: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    params.set(key, String(value));
  }

  const search = params.toString();

  return search ? `?${search}` : '';
}
