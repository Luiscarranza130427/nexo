import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH } from '../password.service.js';

export class LoginDto {
  /** Normalized before validation so casing and stray spaces never block a login. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  /**
   * Only an upper bound is enforced here. Minimum length belongs to password
   * *creation*, not verification: rejecting a short password with 400 instead
   * of 401 would leak nothing useful and only complicate the contract.
   */
  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  /** Required only when the user belongs to more than one organization. */
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
