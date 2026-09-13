import { z } from 'zod';

/** The same policy as the API: length is what matters, composition rules are not imposed. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const name = (required: string) =>
  z.string().trim().min(1, required).max(100, 'No puede superar los 100 caracteres.');

/**
 * A new account. The password is never trimmed: spaces are part of a passphrase.
 * The email is not a field — it comes fixed from the invitation.
 */
export const newAccountSchema = z
  .object({
    firstName: name('Indica tu nombre.'),
    lastName: name('Indica tus apellidos.'),
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
      )
      .max(
        PASSWORD_MAX_LENGTH,
        `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`,
      ),
    confirmPassword: z.string().min(1, 'Repite la contraseña.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  });

export type NewAccountValues = z.infer<typeof newAccountSchema>;

/** An existing account only proves it is theirs; the policy applies to creating passwords. */
export const existingAccountSchema = z.object({
  password: z
    .string()
    .min(1, 'Introduce tu contraseña.')
    .max(
      PASSWORD_MAX_LENGTH,
      `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`,
    ),
});

export type ExistingAccountValues = z.infer<typeof existingAccountSchema>;
