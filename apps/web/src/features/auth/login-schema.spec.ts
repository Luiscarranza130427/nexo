import { loginSchema } from './login-schema';

describe('loginSchema', () => {
  it('accepts a valid pair', () => {
    const result = loginSchema.safeParse({
      email: 'dev@novatec.local',
      password: 'a-long-enough-passphrase',
    });

    expect(result.success).toBe(true);
  });

  it('normalizes the email so casing and stray spaces never block a login', () => {
    const result = loginSchema.safeParse({
      email: '  DEV@NovaTec.LOCAL  ',
      password: 'whatever',
    });

    expect(result.success).toBe(true);
    expect(result.data?.email).toBe('dev@novatec.local');
  });

  it('rejects a malformed email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'whatever' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Introduce un correo electrónico válido.');
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ email: 'dev@novatec.local', password: '' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Introduce tu contraseña.');
  });

  it('does not mirror the backend password policy', () => {
    // Rejecting a short password is the API's call. Duplicating the minimum
    // length here would only advertise the policy to whoever is guessing.
    const result = loginSchema.safeParse({ email: 'dev@novatec.local', password: 'short' });

    expect(result.success).toBe(true);
  });
});
