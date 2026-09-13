/**
 * Prefix of generated project codes.
 *
 * Fixed for now. Making it configurable per organization is a plausible future
 * setting, deliberately not built yet.
 */
export const PROJECT_CODE_PREFIX = 'NEX';

/**
 * Upper bound on code-generation attempts, so a pathological run of collisions
 * fails loudly instead of looping.
 */
export const MAX_CODE_ATTEMPTS = 5;

/** `1` becomes `NEX-001`. Padding is a minimum: `1000` becomes `NEX-1000`, never truncated. */
export function formatProjectCode(sequence: number): string {
  return `${PROJECT_CODE_PREFIX}-${String(sequence).padStart(3, '0')}`;
}
