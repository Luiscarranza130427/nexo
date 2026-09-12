import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const passwords = new PasswordService();
  const password = 'a-sufficiently-long-passphrase';

  it('produces an argon2id hash, never the plain password', async () => {
    const hash = await passwords.hash(password);

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain(password);
  });

  it('accepts the correct password', async () => {
    const hash = await passwords.hash(password);

    await expect(passwords.verify(hash, password)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await passwords.hash(password);

    await expect(passwords.verify(hash, 'not-the-right-password')).resolves.toBe(false);
  });

  it('salts each hash, so the same password hashes differently every time', async () => {
    const [first, second] = await Promise.all([passwords.hash(password), passwords.hash(password)]);

    // Never assert an exact hash: argon2 embeds a random salt.
    expect(first).not.toBe(second);
    await expect(passwords.verify(first, password)).resolves.toBe(true);
    await expect(passwords.verify(second, password)).resolves.toBe(true);
  });

  it('treats a malformed hash as a failed verification rather than throwing', async () => {
    await expect(passwords.verify('not-a-hash', password)).resolves.toBe(false);
  });
});
