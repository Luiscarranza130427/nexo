import { z } from 'zod';

/** Mirrors the backend DTO. OWNER is not offered: ownership is granted later, by an owner. */
export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'El correo no puede superar los 254 caracteres.')
    .pipe(z.email('Introduce un correo electrónico válido.')),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER'], { error: 'Elige un rol.' }),
});

export type InviteFormValues = z.infer<typeof inviteSchema>;
