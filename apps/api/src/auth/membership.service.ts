import { Injectable } from '@nestjs/common';
import type { AuthSession, OrganizationMember, OrganizationSummary } from '@nexo/types';
import { PrismaService } from '../database/prisma.service.js';

/** Exactly what a member listing may reveal: identity, contact and role. */
const MEMBER_SELECT = {
  role: true,
  user: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true },
  },
} as const;

type MemberRow = {
  role: OrganizationMember['role'];
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    email: string;
  };
};

function toOrganizationMember(row: MemberRow): OrganizationMember {
  return {
    userId: row.user.id,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    avatarUrl: row.user.avatarUrl,
    email: row.user.email,
    role: row.role,
  };
}

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

  /**
   * People who can be picked for work inside an organization.
   *
   * Only ACTIVE users: a deactivated account cannot sign in, so offering it for
   * assignment would only produce work nobody can see.
   */
  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId, user: { status: 'ACTIVE' } },
      select: MEMBER_SELECT,
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    });

    return memberships.map(toOrganizationMember);
  }

  /** One active member of an organization, or `null` — the same rule as `listMembers`. */
  async findMember(organizationId: string, userId: string): Promise<OrganizationMember | null> {
    const membership = await this.prisma.membership.findFirst({
      where: { organizationId, userId, user: { status: 'ACTIVE' } },
      select: MEMBER_SELECT,
    });

    return membership ? toOrganizationMember(membership) : null;
  }
}
