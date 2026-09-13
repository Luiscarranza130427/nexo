import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { InvitationStatus } from '../../../generated/prisma/enums.js';

export class QueryInvitationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  /** Matches the invited email. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(254)
  search?: string;

  /** Effective status: PENDING excludes, and EXPIRED includes, pending rows past expiry. */
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;
}
