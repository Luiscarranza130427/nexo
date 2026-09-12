import { clientSchema } from './client-schema';

const VALID = {
  type: 'COMPANY' as const,
  name: 'Acme SAC',
  status: 'PROSPECT' as const,
};

describe('clientSchema', () => {
  it('accepts the minimum a client needs', () => {
    const result = clientSchema.safeParse(VALID);

    expect(result.success).toBe(true);
  });

  it('trims the name but never changes its casing', () => {
    const result = clientSchema.safeParse({ ...VALID, name: '  Acme SAC  ' });

    expect(result.data?.name).toBe('Acme SAC');
  });

  it('rejects an empty or whitespace-only name', () => {
    for (const name of ['', '   ']) {
      const result = clientSchema.safeParse({ ...VALID, name });

      expect(result.success, `name=${JSON.stringify(name)}`).toBe(false);
    }
  });

  it('rejects a name beyond the backend limit', () => {
    const result = clientSchema.safeParse({ ...VALID, name: 'x'.repeat(201) });

    expect(result.success).toBe(false);
  });

  it('turns blank optional fields into null, which is what the API expects', () => {
    const result = clientSchema.safeParse({
      ...VALID,
      documentNumber: '   ',
      phone: '',
      address: '  ',
      email: '',
    });

    expect(result.success).toBe(true);
    expect(result.data?.documentNumber).toBeNull();
    expect(result.data?.phone).toBeNull();
    expect(result.data?.address).toBeNull();
    expect(result.data?.email).toBeNull();
  });

  it('normalizes the email to lowercase', () => {
    const result = clientSchema.safeParse({ ...VALID, email: '  Contacto@ACME.com ' });

    expect(result.data?.email).toBe('contacto@acme.com');
  });

  it('rejects a malformed email but allows no email at all', () => {
    expect(clientSchema.safeParse({ ...VALID, email: 'not-an-email' }).success).toBe(false);
    expect(clientSchema.safeParse({ ...VALID, email: '' }).success).toBe(true);
  });

  it('rejects unknown enum values', () => {
    expect(clientSchema.safeParse({ ...VALID, type: 'ALIEN' }).success).toBe(false);
    expect(clientSchema.safeParse({ ...VALID, status: 'DELETED' }).success).toBe(false);
  });

  it('trims the document number without reformatting it', () => {
    const result = clientSchema.safeParse({ ...VALID, documentNumber: ' 20123456789 ' });

    expect(result.data?.documentNumber).toBe('20123456789');
  });
});
