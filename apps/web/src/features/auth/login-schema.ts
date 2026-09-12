import { z } from 'zod';

/**
 * Client-side login validation.
 *
 * Only what stops a pointless round trip. The password rules live in the
 * backend and are not duplicated here: a login verifies a password, it does not
 * create one, and mirroring the policy would only tell an attacker its shape.
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Introduce un correo electrónico válido.')),
  password: z.string().min(1, 'Introduce tu contraseña.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
