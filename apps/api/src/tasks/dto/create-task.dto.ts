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
import { Priority, TaskStatus } from '../../generated/prisma/enums.js';

/**
 * There is no `position`, `completedAt` or `organizationId`: the API owns all
 * three, and `forbidNonWhitelisted` rejects a request that tries to send them.
 */
export class CreateTaskDto {
  /** The service confirms the project belongs to the caller's organization. */
  @IsUUID()
  projectId!: string;

  @Transform(trimmedOrNull)
  @IsString()
  @MinLength(1, { message: 'title should not be empty' })
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @Transform(trimmedOrNull)
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  /** Defaults to TODO. */
  @ValidateUnlessUndefined()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  /** Defaults to MEDIUM. */
  @ValidateUnlessUndefined()
  @IsEnum(Priority)
  priority?: Priority;

  /** Must be an active member of the project; `null` leaves the task unassigned. */
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  /** ISO 8601. `strict` rejects impossible dates such as 2026-02-30. */
  @IsOptional()
  @IsISO8601({ strict: true })
  startDate?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  dueDate?: string | null;
}
