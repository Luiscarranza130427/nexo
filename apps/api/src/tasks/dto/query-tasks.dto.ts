import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Priority, TaskStatus } from '../../generated/prisma/enums.js';

/** A closed list: the query can never name an arbitrary column. */
export const TASK_SORT_FIELDS = [
  'position',
  'title',
  'priority',
  'createdAt',
  'updatedAt',
  'startDate',
  'dueDate',
] as const;

export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export class QueryTasksDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /** Capped at 100 so a single request cannot be turned into a full export. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Scoped to the organization by the query itself; a foreign id matches nothing. */
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  /** Inclusive lower bound on the due date. */
  @IsOptional()
  @IsISO8601({ strict: true })
  dueFrom?: string;

  /** Inclusive upper bound on the due date. */
  @IsOptional()
  @IsISO8601({ strict: true })
  dueTo?: string;

  @IsOptional()
  @IsEnum(TASK_SORT_FIELDS)
  sortBy: TaskSortField = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
