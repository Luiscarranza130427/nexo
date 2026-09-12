import { SetMetadata } from '@nestjs/common';
import type { MembershipRole } from '../../generated/prisma/enums.js';

export const ROLES_KEY = 'nexo:roles';

/**
 * Restricts an endpoint to the given organization roles.
 *
 * Takes the Prisma `MembershipRole` enum rather than bare strings, so a typo
 * or a renamed role is a compile error instead of a silently open endpoint.
 *
 * @example
 * ```ts
 * @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
 * ```
 */
export const Roles = (...roles: MembershipRole[]) => SetMetadata(ROLES_KEY, roles);
