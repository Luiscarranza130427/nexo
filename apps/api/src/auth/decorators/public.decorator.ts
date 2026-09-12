import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'nexo:isPublic';

/**
 * Opts an endpoint out of the globally applied authentication guard.
 *
 * Routes are protected by default; this is the only way to open one, so every
 * public endpoint is visible as an explicit decision in the code.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
