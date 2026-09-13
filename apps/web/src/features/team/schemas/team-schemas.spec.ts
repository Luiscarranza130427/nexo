import { existingAccountSchema, newAccountSchema } from './accept-invitation-schema';
import { inviteSchema } from './invite-schema';

describe('inviteSchema', () => {
  it('normalizes the email', () => {
    const result = inviteSchema.safeParse({ email: '  Persona@Example.COM ', role: 'MEMBER' });

    expect(result.data).toEqual({ email: 'persona@example.com', role: 'MEMBER' });
  });

  it('rejects an invalid email', () => {
    expect(inviteSchema.safeParse({ email: 'no-es-correo', role: 'MEMBER' }).success).toBe(false);
  });

  it('accepts ADMIN, MANAGER and MEMBER, and never OWNER', () => {
    for (const role of ['ADMIN', 'MANAGER', 'MEMBER']) {
      expect(inviteSchema.safeParse({ email: 'a@example.com', role }).success).toBe(true);
    }

    expect(inviteSchema.safeParse({ email: 'a@example.com', role: 'OWNER' }).success).toBe(false);
  });
});

describe('newAccountSchema', () => {
  const VALID = {
    firstName: 'Lucía',
    lastName: 'Vega',
    password: 'una frase de acceso larga',
    confirmPassword: 'una frase de acceso larga',
  };

  it('accepts a complete account and trims the names, not the password', () => {
    const result = newAccountSchema.safeParse({
      ...VALID,
      firstName: '  Lucía ',
      password: '  espacios incluidos  ',
      confirmPassword: '  espacios incluidos  ',
    });

    expect(result.data?.firstName).toBe('Lucía');
    expect(result.data?.password).toBe('  espacios incluidos  ');
  });

  it('requires both names', () => {
    expect(newAccountSchema.safeParse({ ...VALID, firstName: '   ' }).success).toBe(false);
    expect(newAccountSchema.safeParse({ ...VALID, lastName: '' }).success).toBe(false);
  });

  it('enforces the password length policy', () => {
    const short = 'x'.repeat(11);
    const long = 'x'.repeat(129);

    expect(
      newAccountSchema.safeParse({ ...VALID, password: short, confirmPassword: short }).success,
    ).toBe(false);
    expect(
      newAccountSchema.safeParse({ ...VALID, password: long, confirmPassword: long }).success,
    ).toBe(false);
  });

  it('points a mismatched confirmation at the confirmation field', () => {
    const result = newAccountSchema.safeParse({ ...VALID, confirmPassword: 'otra frase distinta' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['confirmPassword'],
      message: 'Las contraseñas no coinciden.',
    });
  });
});

describe('existingAccountSchema', () => {
  it('only asks for a non-empty password', () => {
    expect(existingAccountSchema.safeParse({ password: 'corta' }).success).toBe(true);
    expect(existingAccountSchema.safeParse({ password: '' }).success).toBe(false);
  });
});
