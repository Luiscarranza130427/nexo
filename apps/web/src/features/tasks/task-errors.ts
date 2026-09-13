import type { TaskErrorCode } from '@nexo/types';
import { ApiError, errorMessage } from '@/lib/api/errors';

/** The machine-readable code of an API error, when there is one. */
export function errorCodeOf(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const code = (error.body as { code?: unknown } | null | undefined)?.code;

  return typeof code === 'string' ? code : null;
}

/** Wording for every refusal specific to tasks. Anything else uses the shared messages. */
export const TASK_ERROR_MESSAGES: Record<TaskErrorCode | 'FORBIDDEN', string> = {
  TASK_NOT_FOUND: 'Esta tarea ya no existe o no está disponible.',
  TASK_PROJECT_NOT_FOUND: 'Ese proyecto ya no está disponible.',
  TASK_ASSIGNEE_NOT_FOUND: 'Esa persona ya no pertenece a la organización.',
  TASK_ASSIGNEE_NOT_PROJECT_MEMBER: 'Esa persona no es miembro del proyecto.',
  INVALID_TASK_DATES: 'La fecha de vencimiento no puede ser anterior a la de inicio.',
  INVALID_TASK_POSITION: 'El tablero cambió mientras movías la tarea. Ya está actualizado.',
  TASK_MOVE_FAILED: 'No se pudo mover la tarea. Inténtalo de nuevo.',
  FORBIDDEN: 'No tienes permisos para cambiar esta tarea.',
};

export function taskErrorMessage(error: unknown): string {
  const code = errorCodeOf(error);

  return code && Object.hasOwn(TASK_ERROR_MESSAGES, code)
    ? TASK_ERROR_MESSAGES[code as keyof typeof TASK_ERROR_MESSAGES]
    : errorMessage(error);
}
