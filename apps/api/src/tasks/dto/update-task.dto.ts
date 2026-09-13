import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto.js';

/**
 * Every field optional, `projectId` absent: moving a task to another project is
 * not supported, so sending it is a 400.
 *
 * `skipNullProperties: false` keeps `null` subject to validation — nullable
 * fields opt out through their own `@IsOptional()`, but `{ "title": null }` is
 * a 400 instead of reaching the database.
 */
export class UpdateTaskDto extends PartialType(OmitType(CreateTaskDto, ['projectId'] as const), {
  skipNullProperties: false,
}) {}
