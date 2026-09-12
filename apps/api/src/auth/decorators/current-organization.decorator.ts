import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthContext } from '../types/auth.types.js';

/**
 * Injects the organization the caller is acting in.
 *
 * The value comes from the validated session, never from a header, query
 * parameter or body field — a client must not be able to name the tenant it
 * wants to operate on.
 */
export const CurrentOrganization = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<{ user: AuthContext }>();

    return request.user.organizationId;
  },
);
