import { z } from 'zod';
import { isCalendarDate } from '@/features/projects/schemas/project-schema';

/** Empty means "no date" and becomes null, which is what the API stores. */
const optionalDate = z
  .string()
  .trim()
  .default('')
  .refine((value) => value === '' || isCalendarDate(value), 'Introduce una fecha válida.')
  .transform((value) => (value === '' ? null : value));

/**
 * Mirrors the backend DTO: same limits, same optionality, same date rule. There
 * is no position and no completedAt — the API owns both. `projectId` only
 * matters on create; an update never sends it.
 */
export const taskSchema = z
  .object({
    projectId: z.uuid({ error: 'Elige un proyecto.' }),
    title: z
      .string()
      .trim()
      .min(1, 'El título es obligatorio.')
      .max(200, 'El título no puede superar los 200 caracteres.'),
    description: z
      .string()
      .trim()
      .max(5000, 'La descripción no puede superar los 5000 caracteres.')
      .default('')
      .transform((value) => (value === '' ? null : value)),
    status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    assigneeId: z
      .union([z.literal(''), z.uuid()])
      .default('')
      .transform((value) => (value === '' ? null : value)),
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

export type TaskFormValues = z.input<typeof taskSchema>;

export type TaskFormOutput = z.output<typeof taskSchema>;
