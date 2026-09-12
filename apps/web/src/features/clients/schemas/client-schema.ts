import type { CreateClientInput } from '@nexo/types';
import { z } from 'zod';

/**
 * Document types offered by the form.
 *
 * Nexo starts with NovaTec in Peru, so these are the common local codes. The
 * database column is free text, so a foreign client needs no migration — the
 * list is a convenience, not a constraint.
 */
export const DOCUMENT_TYPES = ['DNI', 'RUC', 'CE', 'PASSPORT', 'OTHER'] as const;

/**
 * Optional free text.
 *
 * The form always hands over a string (nulls become `''` in the defaults), and
 * a blank one becomes `null` — which is what the API stores for "not set".
 */
const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .default('')
    .transform((value) => (value.length === 0 ? null : value));

/**
 * Mirrors the backend DTO — same limits, same optionality — so the form never
 * accepts something the API will reject, and never rejects something it accepts.
 */
export const clientSchema = z.object({
  type: z.enum(['PERSON', 'COMPANY']),
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio.')
    .max(200, 'El nombre no puede superar los 200 caracteres.'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT']),
  documentType: optionalText(20, 'El tipo de documento es demasiado largo.'),
  documentNumber: optionalText(50, 'El número de documento es demasiado largo.'),
  // Normalized *before* validating: an address pasted with surrounding spaces
  // or in capitals is a valid address, and rejecting it would be pedantic.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .default('')
    .pipe(z.union([z.literal(''), z.email('Introduce un correo electrónico válido.')]))
    .transform((value) => (value === '' ? null : value)),
  phone: optionalText(50, 'El teléfono es demasiado largo.'),
  address: optionalText(500, 'La dirección es demasiado larga.'),
});

export type ClientFormValues = z.input<typeof clientSchema>;

export type ClientFormOutput = z.output<typeof clientSchema>;

/** The form output is already the API contract; this only makes that explicit. */
export function toCreateInput(values: ClientFormOutput): CreateClientInput {
  return values;
}
