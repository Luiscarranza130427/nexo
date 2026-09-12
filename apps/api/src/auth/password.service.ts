import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

/**
 * Length is the requirement that actually matters. Composition rules
 * ("one uppercase, one symbol") push people towards predictable passwords and
 * away from long passphrases, so they are deliberately not enforced.
 */
export const PASSWORD_MIN_LENGTH = 12;

/** Upper bound, so an enormous input cannot be used to burn CPU on hashing. */
export const PASSWORD_MAX_LENGTH = 128;

@Injectable()
export class PasswordService {
  /**
   * Argon2id with the OWASP Password Storage baseline: 19 MiB of memory, two
   * iterations, one lane. Argon2id is used rather than bcrypt because it
   * resists GPU and side-channel attacks far better at comparable cost.
   */
  private static readonly OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  } as const;

  /** Produces an Argon2id hash. The salt is generated and embedded by argon2. */
  hash(password: string): Promise<string> {
    return argon2.hash(password, PasswordService.OPTIONS);
  }

  /**
   * Verifies a password against a stored hash.
   *
   * A malformed, truncated or foreign-format hash must read as "wrong
   * password", never as a crash that could distinguish one account from another.
   */
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
