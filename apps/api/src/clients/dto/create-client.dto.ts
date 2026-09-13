import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ClientStatus, ClientType } from '../../generated/prisma/enums.js';

/** Trims a string and turns an empty result into null, so blank inputs clear a field. */
const trimmed = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const next = value.trim();

  return next.length === 0 ? null : next;
};

/** Trims, then lowercases. Used for email, where case carries no meaning. */
const trimmedLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() || null : value;

/** Trims, then uppercases. Document types are codes (DNI, RUC, CE…). */
const trimmedUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() || null : value;

export class CreateClientDto {
  @IsEnum(ClientType)
  type!: ClientType;

  /** Never case-folded: a client's name is theirs, not a code. */
  @Transform(trimmed)
  @IsString()
  @MinLength(1, { message: 'name should not be empty' })
  @MaxLength(200)
  name!: string;

  /**
   * Kept as free text rather than a database enum. Nexo starts with NovaTec in
   * Peru (DNI, RUC, CE, PASSPORT), but a fixed enum would need a migration the
   * first time a client is foreign. The frontend offers the common values.
   */
  @IsOptional()
  @Transform(trimmedUpper)
  @IsString()
  @MaxLength(20)
  documentType?: string | null;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(50)
  documentNumber?: string | null;

  @IsOptional()
  @Transform(trimmedLower)
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  address?: string | null;

  /**
   * Defaults to PROSPECT: a client is usually recorded while still being
   * courted, and marking them ACTIVE before any work exists would overstate
   * the relationship.
   */
  // Validated even when null: the column is not nullable, so null is a 400.
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ClientStatus)
  status?: ClientStatus;
}
