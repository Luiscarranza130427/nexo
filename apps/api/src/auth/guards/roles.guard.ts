import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { MembershipService } from '../membership.service.js';
import type { AuthContext } from '../types/auth.types.js';
import type { MembershipRole } from '../../generated/prisma/enums.js';

/**
 * Enforces `@Roles(...)`.
 *
 * The role is re-read from the database on every check rather than taken from
 * the token, so removing a member or demoting them takes effect immediately.
 * `MembershipService.resolve` also verifies that the user and the organization
 * are still ACTIVE, which means a deactivated account loses access at once.
 *
 * Roles are matched exactly: there is no implicit hierarchy, so `@Roles(ADMIN)`
 * does **not** admit an OWNER. List every role that should pass.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly memberships: MembershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<MembershipRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles on this route: authentication alone is enough.
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthContext }>();
    const auth = request.user;

    if (!auth) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient permissions.' });
    }

    const resolved = await this.memberships.resolve(auth.userId, auth.organizationId);

    if (!resolved || !required.includes(resolved.membership.role)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient permissions.' });
    }

    return true;
  }
}
