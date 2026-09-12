import { Injectable } from '@nestjs/common';
import type { AuthSession, OrganizationSummary } from '@nexo/types';
import { PrismaService } from '../database/prisma.service.js';

/**
 * Resolves who the caller is and what they may do, straight from the database.
 *
 * Every authorization decision goes through here rather than trusting claims
 * inside a token. If an administrator changes a role or removes a member, the
 * next request already sees it — no waiting for a token to expire.
 */
@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Re-reads user, organization and role.
   *
   * Returns `null` when any link in the chain is missing or inactive: the user
   * is gone or deactivated, the organization is gone or inactive, or the
   * membership no longer exists.
   */
  async resolve(userId: string, organizationId: string): Promise<AuthSession | null> {
    const membership = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: { user: true, organization: true },
    });

    if (!membership) {
      return null;
    }

    if (membership.user.status !== 'ACTIVE' || membership.organization.status !== 'ACTIVE') {
      return null;
    }

    return {
      user: {
        id: membership.user.id,
        email: membership.user.email,
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        avatarUrl: membership.user.avatarUrl,
      },
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
      },
      membership: { role: membership.role },
    };
  }

  /**
   * Active organizations the user can sign in to.
   *
   * Only id, name and slug: this list is shown before a session exists, so it
   * must carry nothing beyond what a chooser needs.
   */
  async listOrganizations(userId: string): Promise<OrganizationSummary[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, organization: { status: 'ACTIVE' } },
      select: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: { organization: { name: 'asc' } },
    });

    return memberships.map((membership) => membership.organization);
  }
}
