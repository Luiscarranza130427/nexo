import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TaskStatus } from '../../generated/prisma/enums.js';

/**
 * Where a task lands, described by its new neighbours rather than a raw
 * position. A position sent by a client is only as good as that client's stale
 * view of the column; neighbour ids are resolved against the current state
 * inside the transaction.
 */
export class MoveTaskDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  /** The task that will sit directly above the moved one. */
  @IsOptional()
  @IsUUID()
  afterTaskId?: string | null;

  /** The task that will sit directly below the moved one. */
  @IsOptional()
  @IsUUID()
  beforeTaskId?: string | null;
}
