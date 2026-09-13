import { ValidateIf } from 'class-validator';

/** Trims a string and turns a blank result into null, so an emptied field clears. */
export const trimmedOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const next = value.trim();

  return next.length === 0 ? null : next;
};

/**
 * Validates a property even when it is `null`, unlike `@IsOptional()`.
 *
 * For columns that are not nullable: `null` must be a 400, not a database error.
 */
export const ValidateUnlessUndefined = () =>
  ValidateIf((_object: object, value: unknown) => value !== undefined);
