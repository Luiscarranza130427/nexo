import type { InvitationErrorCode, TeamErrorCode } from '@nexo/types';
import { errorCodeOf, errorMessage } from '@/lib/api/errors';

/** Wording for every refusal of the team module. Anything else uses the shared messages. */
export const TEAM_ERROR_MESSAGES: Record<
  TeamErrorCode | InvitationErrorCode | 'FORBIDDEN' | 'INVALID_CREDENTIALS',
  string
> = {
  TEAM_MEMBER_NOT_FOUND: 'Esta persona ya no forma parte de la organización.',
  LAST_OWNER_REQUIRED: 'La organización debe conservar al menos un propietario activo.',
  INVITATION_NOT_FOUND: 'Esta invitación no existe o el enlace no es válido.',
  INVITATION_EXPIRED: 'Esta invitación ha expirado.',
  INVITATION_REVOKED: 'Esta invitación fue revocada.',
  INVITATION_ALREADY_ACCEPTED: 'Esta invitación ya fue aceptada.',
  INVITATION_ALREADY_PENDING:
    'Ese correo ya tiene una invitación pendiente. Revócala antes de crear otra.',
  INVITATION_ACCOUNT_CHANGED:
    'La cuenta de este correo cambió mientras aceptabas. Vuelve a intentarlo.',
  INVITATION_PROFILE_REQUIRED: 'Indica tu nombre y apellidos para crear la cuenta.',
  INVALID_PASSWORD: 'La contraseña debe tener entre 12 y 128 caracteres.',
  USER_ALREADY_MEMBER: 'Esa persona ya forma parte de la organización.',
  INVALID_CREDENTIALS: 'La contraseña no es correcta.',
  FORBIDDEN: 'Tu rol no permite hacer este cambio.',
};

export function teamErrorMessage(error: unknown): string {
  const code = errorCodeOf(error);

  return code && Object.hasOwn(TEAM_ERROR_MESSAGES, code)
    ? TEAM_ERROR_MESSAGES[code as keyof typeof TEAM_ERROR_MESSAGES]
    : errorMessage(error);
}
