import type { AuthErrorCode, OrganizationSummary } from '@nexo/types';

/**
 * Every error code the frontend may see: the ones the API defines, plus two
 * for failures that never reach the API at all.
 */
export type ApiErrorCode = AuthErrorCode | 'NETWORK_ERROR' | 'UNKNOWN';

/**
 * A normalized API failure.
 *
 * One error type for the whole frontend, so nothing has to write
 * `catch (error: any)` and guess at the shape of what it caught.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  /** Raw response body, for the few cases that carry extra data. */
  readonly body: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** Shape the API uses for its error bodies. */
type ErrorBody = {
  code?: unknown;
  message?: unknown;
  organizations?: unknown;
};

const KNOWN_CODES: readonly string[] = [
  'INVALID_CREDENTIALS',
  'ORGANIZATION_REQUIRED',
  'INVALID_ORGANIZATION',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'UNAUTHORIZED',
  'FORBIDDEN',
];

function isKnownCode(value: unknown): value is AuthErrorCode {
  return typeof value === 'string' && KNOWN_CODES.includes(value);
}

/**
 * Turns any failed response into an ApiError.
 *
 * Bodies that do not follow the contract still produce a usable error rather
 * than leaking a parse failure into the UI.
 */
export function normalizeApiError(status: number, body: unknown): ApiError {
  const payload: ErrorBody = typeof body === 'object' && body !== null ? body : {};
  const code = isKnownCode(payload.code) ? payload.code : fallbackCodeFor(status);
  const message =
    typeof payload.message === 'string' ? payload.message : `Request failed (${status}).`;

  return new ApiError(status, code, message, body);
}

function fallbackCodeFor(status: number): ApiErrorCode {
  if (status === 401) {
    return 'UNAUTHORIZED';
  }

  if (status === 403) {
    return 'FORBIDDEN';
  }

  return 'UNKNOWN';
}

/** The request never reached the API (offline, DNS, CORS, aborted). */
export function networkError(cause: unknown): ApiError {
  return new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor.', cause);
}

/**
 * Narrows an error to the "pick an organization" case, exposing the choices.
 *
 * The API returns these after the credentials have already been verified, so
 * showing them leaks nothing.
 */
export function organizationChoices(error: unknown): OrganizationSummary[] | null {
  if (!(error instanceof ApiError) || error.code !== 'ORGANIZATION_REQUIRED') {
    return null;
  }

  const body = error.body;

  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const { organizations } = body as ErrorBody;

  if (!Array.isArray(organizations)) {
    return null;
  }

  return organizations.filter(
    (item): item is OrganizationSummary =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as OrganizationSummary).id === 'string' &&
      typeof (item as OrganizationSummary).name === 'string',
  );
}

/** Spanish, user-facing wording for each code. Never shows technical detail. */
const MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  ORGANIZATION_REQUIRED: 'Selecciona una organización para continuar.',
  INVALID_ORGANIZATION: 'No tienes acceso a esa organización.',
  SESSION_EXPIRED: 'Tu sesión ha expirado. Vuelve a iniciar sesión.',
  SESSION_REVOKED: 'Tu sesión se ha cerrado. Vuelve a iniciar sesión.',
  UNAUTHORIZED: 'Necesitas iniciar sesión para continuar.',
  FORBIDDEN: 'No tienes permisos para realizar esta acción.',
  NETWORK_ERROR: 'No se pudo conectar con el servidor. Revisa tu conexión.',
  UNKNOWN: 'Ha ocurrido un error inesperado. Inténtalo de nuevo.',
};

/**
 * The message to show a person.
 *
 * Deliberately ignores the server's own message text: it is written for
 * developers, and stack traces or raw JSON must never reach the interface.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code];
  }

  return MESSAGES.UNKNOWN;
}

/** The machine-readable code an API error carries in its body, when there is one. */
export function errorCodeOf(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const code = (error.body as { code?: unknown } | null | undefined)?.code;

  return typeof code === 'string' ? code : null;
}
