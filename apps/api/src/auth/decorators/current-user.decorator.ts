import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthContext } from '../types/auth.types.js';

/**
 * Injects the validated authentication context.
 *
 * Typed on purpose: nothing in the application should reach for
 * `request.user as any`. The context comes from the access token after the
 * guard has checked it, never from client-supplied input.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const request = context.switchToHttp().getRequest<{ user: AuthContext }>();

    return request.user;
  },
);
