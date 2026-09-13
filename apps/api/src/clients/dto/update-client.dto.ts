import { PartialType } from '@nestjs/mapped-types';
import { CreateClientDto } from './create-client.dto.js';

/**
 * Every field optional, and nothing else accepted.
 *
 * `id`, `organizationId` and the timestamps are absent by construction: the
 * global ValidationPipe runs with `forbidNonWhitelisted`, so a request that
 * tries to send them is rejected rather than silently ignored.
 *
 * `skipNullProperties: false` keeps `null` subject to validation. Nullable
 * fields still opt out through their own `@IsOptional()`, so blanking an email
 * works, but `{ "name": null }` is a 400 instead of reaching the database.
 */
export class UpdateClientDto extends PartialType(CreateClientDto, {
  skipNullProperties: false,
}) {}
