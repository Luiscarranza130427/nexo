import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ValidateUnlessUndefined, trimmedOrNull } from '../../common/validation.js';
import { Priority, ProjectStatus } from '../../generated/prisma/enums.js';

export class CreateProjectDto {
  @Transform(trimmedOrNull)
  @IsString()
  @MinLength(1, { message: 'name should not be empty' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @Transform(trimmedOrNull)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  /**
   * Optional; `null` on update unlinks the client. Only the format is checked
   * here — the service confirms the client belongs to the caller's organization.
   */
  @IsOptional()
  @IsUUID()
  clientId?: string | null;

  /** Defaults to PLANNING: a new project has not started yet. */
  @ValidateUnlessUndefined()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  /** Defaults to MEDIUM: nothing is urgent until someone says so. */
  @ValidateUnlessUndefined()
  @IsEnum(Priority)
  priority?: Priority;

  /** ISO 8601. `strict` rejects impossible dates such as 2026-02-30. */
  @IsOptional()
  @IsISO8601({ strict: true })
  startDate?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  dueDate?: string | null;
}
