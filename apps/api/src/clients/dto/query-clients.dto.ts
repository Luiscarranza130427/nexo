import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ClientStatus, ClientType } from '../../generated/prisma/enums.js';

export const CLIENT_SORT_FIELDS = ['name', 'createdAt', 'updatedAt'] as const;

export type ClientSortField = (typeof CLIENT_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortOrder = (typeof SORT_ORDERS)[number];

export class QueryClientsDto {
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
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @IsOptional()
  @IsEnum(ClientType)
  type?: ClientType;

  @IsOptional()
  @IsEnum(CLIENT_SORT_FIELDS)
  sortBy: ClientSortField = 'createdAt';

  @IsOptional()
  @IsEnum(SORT_ORDERS)
  sortOrder: SortOrder = 'desc';
}
