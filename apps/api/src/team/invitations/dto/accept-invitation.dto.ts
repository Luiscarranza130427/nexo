import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH } from '../../../auth/password.service.js';
import { trimmedOrNull } from '../../../common/validation.js';

/**
 * One body for both kinds of invitee. For an existing account `password`
 * proves the account is theirs; for a new one it becomes the password and the
 * names are required. The service knows which applies — the client only says
 * what it has.
 */
export class AcceptInvitationDto {
  @IsString()
  @MaxLength(100)
  token!: string;

  /** Only an upper bound here: the minimum applies to creating a password, not proving one. */
  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @IsOptional()
  @Transform(trimmedOrNull)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string | null;

  @IsOptional()
  @Transform(trimmedOrNull)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string | null;
}
