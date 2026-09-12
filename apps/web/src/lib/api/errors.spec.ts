import {
  ApiError,
  errorMessage,
  networkError,
  normalizeApiError,
  organizationChoices,
} from './errors';

describe('normalizeApiError', () => {
  it('keeps a known code from the API', () => {
    const error = normalizeApiError(401, {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials.',
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(error.status).toBe(401);
  });

  it('falls back to a status-derived code when the body has none', () => {
    expect(normalizeApiError(401, {}).code).toBe('UNAUTHORIZED');
    expect(normalizeApiError(403, {}).code).toBe('FORBIDDEN');
    expect(normalizeApiError(500, {}).code).toBe('UNKNOWN');
  });

  it('survives a body that does not follow the contract', () => {
    // A proxy returning an HTML error page must not crash the client.
    expect(normalizeApiError(502, '<html>Bad gateway</html>').code).toBe('UNKNOWN');
    expect(normalizeApiError(500, null).code).toBe('UNKNOWN');
  });

  it('ignores an unrecognized code rather than trusting it', () => {
    expect(normalizeApiError(400, { code: 'SOMETHING_NEW' }).code).toBe('UNKNOWN');
  });
});

describe('organizationChoices', () => {
  const body = {
    code: 'ORGANIZATION_REQUIRED',
    organizations: [
      { id: 'org-1', name: 'NovaTec', slug: 'novatec' },
      { id: 'org-2', name: 'Other', slug: 'other' },
    ],
  };

  it('extracts the choices from the error', () => {
    const choices = organizationChoices(normalizeApiError(409, body));

    expect(choices).toHaveLength(2);
    expect(choices?.[0]?.name).toBe('NovaTec');
  });

  it('returns null for any other error', () => {
    expect(organizationChoices(normalizeApiError(401, { code: 'INVALID_CREDENTIALS' }))).toBeNull();
    expect(organizationChoices(new Error('boom'))).toBeNull();
  });

  it('returns null when the list is missing', () => {
    expect(
      organizationChoices(normalizeApiError(409, { code: 'ORGANIZATION_REQUIRED' })),
    ).toBeNull();
  });
});

describe('errorMessage', () => {
  it('maps every code to human wording', () => {
    expect(errorMessage(normalizeApiError(401, { code: 'INVALID_CREDENTIALS' }))).toBe(
      'Correo o contraseña incorrectos.',
    );
    expect(errorMessage(networkError(new Error('offline')))).toBe(
      'No se pudo conectar con el servidor. Revisa tu conexión.',
    );
  });

  it('never surfaces the server message, which is written for developers', () => {
    const error = normalizeApiError(500, {
      message: 'PrismaClientKnownRequestError: connect ECONNREFUSED 127.0.0.1:5434',
    });

    const shown = errorMessage(error);

    expect(shown).toBe('Ha ocurrido un error inesperado. Inténtalo de nuevo.');
    expect(shown).not.toContain('Prisma');
    expect(shown).not.toContain('127.0.0.1');
  });

  it('handles a non-ApiError without leaking its message', () => {
    expect(errorMessage(new Error('internal stack trace'))).toBe(
      'Ha ocurrido un error inesperado. Inténtalo de nuevo.',
    );
  });
});
