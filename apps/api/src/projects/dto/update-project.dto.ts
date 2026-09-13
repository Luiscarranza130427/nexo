import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-project.dto.js';

/**
 * Every field optional, and nothing else accepted.
 *
 * `code`, `id`, `organizationId` and the timestamps are absent by construction,
 * so `forbidNonWhitelisted` rejects any attempt to send them.
 *
 * `skipNullProperties: false` keeps `null` subject to validation: a nullable
 * field still opts out through its own `@IsOptional()`, but `{ "name": null }`
 * is a 400 rather than a database error.
 */
export class UpdateProjectDto extends PartialType(CreateProjectDto, {
  skipNullProperties: false,
}) {}
