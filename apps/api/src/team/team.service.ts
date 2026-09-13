import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MembershipRole,
  Paginated,
  ProjectTaskSummary,
  TeamMember,
  TeamMemberDetail,
  TeamSummary,
  TaskStatus,
  UserStatus,
} from '@nexo/types';
import { MembershipService } from '../auth/membership.service.js';
import type { AuthContext } from '../auth/types/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import type { ChangeRoleDto } from './dto/change-role.dto.js';
import type { QueryTeamDto, TeamSortField } from './dto/query-team.dto.js';
import { lockOrganization } from './organization-lock.js';
import { hasAuthorityOver, leavesAnOwner } from './team-rules.js';

/** Profiles list at most this many projects; the count is always exact. */
const PROFILE_PROJECT_LIMIT = 50;

/**
 * What a team row may reveal. No password hash, no sessions, no organization
 * internals. The project count is scoped to this organization, since a person
 * may also work in others.
 */
function memberSelect(organizationId: string) {
  return {
    role: true,
    createdAt: true,
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        status: true,
        _count: {
          select: { projectMemberships: { where: { project: { organizationId } } } },
        },
      },
    },
  } as const;
}

type MemberRow = {
  role: MembershipRole;
  createdAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    status: UserStatus;
    _count: { projectMemberships: number };
  };
};

function toTeamMember(row: MemberRow): TeamMember {
  return {
    userId: row.user.id,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    email: row.user.email,
    avatarUrl: row.user.avatarUrl,
    status: row.user.status,
    role: row.role,
    joinedAt: row.createdAt.toISOString(),
    projectsCount: row.user._count.projectMemberships,
  };
}

/** Every word must appear in the first name, the last name or the email. */
function searchWhere(search: string | undefined) {
  const terms = (search ?? '').split(/\s+/).filter(Boolean).slice(0, 5);

  if (terms.length === 0) {
    return {};
  }

  return {
    AND: terms.map((term) => ({
      OR: [
        { firstName: { contains: term, mode: 'insensitive' as const } },
        { lastName: { contains: term, mode: 'insensitive' as const } },
        { email: { contains: term, mode: 'insensitive' as const } },
      ],
    })),
  };
}

/** Explicit order clauses; `id` breaks ties so pages never overlap or skip rows. */
function orderByFor(field: TeamSortField, order: 'asc' | 'desc') {
  switch (field) {
    case 'name':
      return [
        { user: { firstName: order } },
        { user: { lastName: order } },
        { id: 'asc' as const },
      ];
    case 'email':
      return [{ user: { email: order } }, { id: 'asc' as const }];
    case 'role':
      // Declaration order: OWNER, ADMIN, MANAGER, MEMBER.
      return [{ role: order }, { user: { firstName: 'asc' as const } }, { id: 'asc' as const }];
    case 'joinedAt':
      return [{ createdAt: order }, { id: 'asc' as const }];
  }
}

function taskSummary(
  groups: { status: TaskStatus; _count: { _all: number } }[],
): ProjectTaskSummary {
  const count = (status: TaskStatus) =>
    groups.find((group) => group.status === status)?._count._all ?? 0;
  const summary = {
    todo: count('TODO'),
    inProgress: count('IN_PROGRESS'),
    inReview: count('IN_REVIEW'),
    done: count('DONE'),
    cancelled: count('CANCELLED'),
  };

  return {
    total: Object.values(summary).reduce((sum, value) => sum + value, 0),
    ...summary,
  };
}

type TeamTx = Pick<
  PrismaService,
  '$queryRaw' | 'membership' | 'projectMember' | 'task' | 'session'
>;

/** A membership with just what the permission checks need. */
function loadMembership(tx: TeamTx, organizationId: string, userId: string) {
  return tx.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true, user: { select: { status: true } } },
  });
}

function countActiveOwners(tx: TeamTx, organizationId: string) {
  return tx.membership.count({
    where: { organizationId, role: 'OWNER', user: { status: 'ACTIVE' } },
  });
}

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberships: MembershipService,
  ) {}

  private static notFound(): NotFoundException {
    return new NotFoundException({ code: 'TEAM_MEMBER_NOT_FOUND', message: 'Member not found.' });
  }

  private static forbidden(): ForbiddenException {
    return new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient permissions.' });
  }

  private static lastOwner(): ConflictException {
    return new ConflictException({
      code: 'LAST_OWNER_REQUIRED',
      message: 'An organization must keep at least one active owner.',
    });
  }

  async list(organizationId: string, query: QueryTeamDto): Promise<Paginated<TeamMember>> {
    const { page, limit, role, status, search, sortBy, sortOrder } = query;
    const userWhere = { ...(status ? { status } : {}), ...searchWhere(search) };
    const where = {
      organizationId,
      ...(role ? { role } : {}),
      ...(Object.keys(userWhere).length > 0 ? { user: userWhere } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.membership.findMany({
        where,
        select: memberSelect(organizationId),
        orderBy: orderByFor(sortBy, sortOrder),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.membership.count({ where }),
    ]);

    return {
      data: rows.map(toTeamMember),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** One grouped count, never a scan of the list. */
  async summary(organizationId: string): Promise<TeamSummary> {
    const groups = await this.prisma.membership.groupBy({
      by: ['role'],
      where: { organizationId },
      _count: { _all: true },
    });
    const byRole: Record<MembershipRole, number> = { OWNER: 0, ADMIN: 0, MANAGER: 0, MEMBER: 0 };

    for (const group of groups) {
      byRole[group.role] = group._count._all;
    }

    return { total: Object.values(byRole).reduce((sum, value) => sum + value, 0), byRole };
  }

  /**
   * A member's profile. A person outside this organization answers 404. A
   * MEMBER looking at someone else sees only the projects they share — the
   * same visibility rule as tasks.
   */
  async detail(auth: AuthContext, userId: string): Promise<TeamMemberDetail> {
    const { organizationId } = auth;
    const viewer = await this.memberships.resolve(auth.userId, organizationId);

    if (!viewer) {
      throw TeamService.forbidden();
    }

    const row = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: memberSelect(organizationId),
    });

    if (!row) {
      throw TeamService.notFound();
    }

    const sharedOnly = viewer.membership.role === 'MEMBER' && auth.userId !== userId;
    const viewerProjects = sharedOnly ? [{ members: { some: { userId: auth.userId } } }] : [];

    const [projects, taskGroups] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          organizationId,
          AND: [{ members: { some: { userId } } }, ...viewerProjects],
        },
        select: { id: true, code: true, name: true, status: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: PROFILE_PROJECT_LIMIT,
      }),
      this.prisma.task.groupBy({
        by: ['status'],
        where: {
          organizationId,
          assigneeId: userId,
          ...(sharedOnly ? { project: { members: { some: { userId: auth.userId } } } } : {}),
        },
        _count: { _all: true },
      }),
    ]);

    return { ...toTeamMember(row), projects, tasks: taskSummary(taskGroups) };
  }

  /**
   * Changes a member's role. Takes effect on the member's next request: roles
   * are re-read from the database, never taken from a token, so no session
   * needs to end.
   */
  async changeRole(auth: AuthContext, userId: string, dto: ChangeRoleDto): Promise<TeamMember> {
    const { organizationId } = auth;

    return this.prisma.$transaction(async (tx) => {
      await lockOrganization(tx, organizationId);

      const [actor, target] = await Promise.all([
        loadMembership(tx, organizationId, auth.userId),
        loadMembership(tx, organizationId, userId),
      ]);

      if (!actor || actor.user.status !== 'ACTIVE') {
        throw TeamService.forbidden();
      }

      if (!target) {
        throw TeamService.notFound();
      }

      // Authority over both who the member is now and what they would become.
      if (!hasAuthorityOver(actor.role, target.role) || !hasAuthorityOver(actor.role, dto.role)) {
        throw TeamService.forbidden();
      }

      if (target.role === 'OWNER' && dto.role !== 'OWNER') {
        const owners = await countActiveOwners(tx, organizationId);

        if (!leavesAnOwner(owners, target.user.status === 'ACTIVE')) {
          throw TeamService.lastOwner();
        }
      }

      const row =
        target.role === dto.role
          ? await tx.membership.findUniqueOrThrow({
              where: { organizationId_userId: { organizationId, userId } },
              select: memberSelect(organizationId),
            })
          : await tx.membership.update({
              where: { organizationId_userId: { organizationId, userId } },
              data: { role: dto.role },
              select: memberSelect(organizationId),
            });

      return toTeamMember(row);
    });
  }

  /**
   * Removes a person from this organization, and only from it. The account,
   * the projects and the tasks all stay: the person leaves every project here,
   * their tasks here become unassigned, and their sessions in this
   * organization end at once. Sessions in other organizations are untouched.
   */
  async remove(auth: AuthContext, userId: string): Promise<void> {
    const { organizationId } = auth;

    await this.prisma.$transaction(async (tx) => {
      await lockOrganization(tx, organizationId);

      const [actor, target] = await Promise.all([
        loadMembership(tx, organizationId, auth.userId),
        loadMembership(tx, organizationId, userId),
      ]);

      if (!actor || actor.user.status !== 'ACTIVE') {
        throw TeamService.forbidden();
      }

      if (!target) {
        throw TeamService.notFound();
      }

      if (!hasAuthorityOver(actor.role, target.role)) {
        throw TeamService.forbidden();
      }

      if (target.role === 'OWNER') {
        const owners = await countActiveOwners(tx, organizationId);

        if (!leavesAnOwner(owners, target.user.status === 'ACTIVE')) {
          throw TeamService.lastOwner();
        }
      }

      await tx.projectMember.deleteMany({ where: { userId, project: { organizationId } } });
      await tx.task.updateMany({
        where: { organizationId, assigneeId: userId },
        data: { assigneeId: null },
      });
      await tx.session.updateMany({
        where: { userId, organizationId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.membership.delete({
        where: { organizationId_userId: { organizationId, userId } },
      });
    });
  }
}
