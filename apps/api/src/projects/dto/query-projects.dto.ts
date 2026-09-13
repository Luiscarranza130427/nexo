import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Priority, ProjectStatus } from '../../generated/prisma/enums.js';

/** A closed list: the query can never name an arbitrary column. */
export const PROJECT_SORT_FIELDS = [
  'name',
  'code',
  'createdAt',
  'updatedAt',
  'startDate',
  'dueDate',
  'priority',
] as const;

export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number];

export class QueryProjectsDto {
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
  limit: number = 10;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  /** Scoped to the organization by the query itself; a foreign id matches nothing. */
  @IsOptional()
  @IsUUID()
  clientId?: string;

  /** Projects where this user is a member. Same scoping as `clientId`. */
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsEnum(PROJECT_SORT_FIELDS)
  sortBy: ProjectSortField = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
