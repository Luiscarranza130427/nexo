import { PartialType } from '@nestjs/mapped-types';
import { CreateClientDto } from './create-client.dto.js';

/**
 * Every field optional, and nothing else accepted.
 *
 * `id`, `organizationId` and the timestamps are absent by construction: the
 * global ValidationPipe runs with `forbidNonWhitelisted`, so a request that
 * tries to send them is rejected rather than silently ignored.
 */
export class UpdateClientDto extends PartialType(CreateClientDto) {}
