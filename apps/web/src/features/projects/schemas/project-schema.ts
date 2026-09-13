import { z } from 'zod';

const DATE_INPUT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A real calendar date in `YYYY-MM-DD`. The round trip rejects dates a parser
 * would silently roll over, such as 2026-02-30 turning into 2 March.
 */
export function isCalendarDate(value: string): boolean {
  if (!DATE_INPUT.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Empty means "no date" and becomes null, which is what the API stores. */
const optionalDate = z
  .string()
  .trim()
  .default('')
  .refine((value) => value === '' || isCalendarDate(value), 'Introduce una fecha válida.')
  .transform((value) => (value === '' ? null : value));

/**
 * Mirrors the backend DTO: same limits, same optionality, same date rule. There
 * is no `code` field — the API generates it and it never changes.
 */
export const projectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'El nombre es obligatorio.')
      .max(200, 'El nombre no puede superar los 200 caracteres.'),
    description: z
      .string()
      .trim()
      .max(2000, 'La descripción no puede superar los 2000 caracteres.')
      .default('')
      .transform((value) => (value === '' ? null : value)),
    clientId: z
      .union([z.literal(''), z.uuid()])
      .default('')
      .transform((value) => (value === '' ? null : value)),
    status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    startDate: optionalDate,
    dueDate: optionalDate,
  })
  .superRefine((values, context) => {
    // `YYYY-MM-DD` strings compare correctly as text.
    if (values.startDate && values.dueDate && values.dueDate < values.startDate) {
      context.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'La fecha de vencimiento no puede ser anterior a la de inicio.',
      });
    }
  });

export type ProjectFormValues = z.input<typeof projectSchema>;

export type ProjectFormOutput = z.output<typeof projectSchema>;
