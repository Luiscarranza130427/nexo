import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MembershipRole, UserStatus } from '../../generated/prisma/enums.js';

/** A closed list: the query can never name an arbitrary column. */
export const TEAM_SORT_FIELDS = ['name', 'email', 'role', 'joinedAt'] as const;

export type TeamSortField = (typeof TEAM_SORT_FIELDS)[number];

export class QueryTeamDto {
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

  /** Matches first name, last name and email; every word must match. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(TEAM_SORT_FIELDS)
  sortBy: TeamSortField = 'name';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
}
