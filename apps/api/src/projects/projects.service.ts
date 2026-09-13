import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  OrganizationMember,
  Paginated,
  ProjectDetail,
  ProjectListItem,
  ProjectTaskSummary,
} from '@nexo/types';
import { MembershipService } from '../auth/membership.service.js';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import type { ProjectSortField, QueryProjectsDto } from './dto/query-projects.dto.js';
import type { UpdateProjectDto } from './dto/update-project.dto.js';
import { MAX_CODE_ATTEMPTS, formatProjectCode } from './project-code.js';

/**
 * Exactly the scalar fields and client reference a project exposes.
 * `organizationId` is never selected.
 */
const BASE_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  status: true,
  priority: true,
  startDate: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
} as const;

/**
 * Members that still count: active users who still belong to the organization.
 * Someone deactivated or removed from the organization keeps their assignment
 * row, but drops out of counts and lists; the team module will own cleanup.
 */
function currentMembers(organizationId: string) {
  return { user: { status: 'ACTIVE' as const, memberships: { some: { organizationId } } } };
}

type BaseRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: ProjectDetail['status'];
  priority: ProjectDetail['priority'];
  startDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string } | null;
};

const iso = (value: Date | null) => (value ? value.toISOString() : null);

/** Built field by field, so nothing selected for internal use (counts) leaks out. */
function toBase(row: BaseRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    priority: row.priority,
    startDate: iso(row.startDate),
    dueDate: iso(row.dueDate),
    client: row.client,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** `YYYY-MM-DD` becomes UTC midnight; `null` stays `null`. No timezone logic beyond that. */
function parseDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

/** Prisma signals a unique-constraint violation with P2002. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
  );
}

/**
 * Sort fields map to explicit order clauses. Dates sort empty values last in
 * either direction, and `id` breaks ties so pages never overlap or skip rows
 * when many projects share a status, priority or date.
 */
function orderByFor(field: ProjectSortField, order: 'asc' | 'desc') {
  switch (field) {
    case 'startDate':
      return [{ startDate: { sort: order, nulls: 'last' as const } }, { id: 'asc' as const }];
    case 'dueDate':
      return [{ dueDate: { sort: order, nulls: 'last' as const } }, { id: 'asc' as const }];
    case 'name':
      return [{ name: order }, { id: 'asc' as const }];
    case 'code':
      return [{ code: order }, { id: 'asc' as const }];
    case 'priority':
      // PostgreSQL orders enums by declaration: LOW < MEDIUM < HIGH < URGENT.
      return [{ priority: order }, { id: 'asc' as const }];
    case 'updatedAt':
      return [{ updatedAt: order }, { id: 'asc' as const }];
    case 'createdAt':
      return [{ createdAt: order }, { id: 'asc' as const }];
  }
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memberships: MembershipService,
  ) {}

  private static notFound(): NotFoundException {
    // Same answer for "does not exist" and "belongs to another organization":
    // a 403 would confirm the id is real, which leaks across tenants.
    return new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
  }

  /** Confirms the project belongs to the organization. Returns what update needs. */
  private async requireProject(organizationId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId },
      select: { id: true, startDate: true, dueDate: true },
    });

    if (!project) {
      throw ProjectsService.notFound();
    }

    return project;
  }

  /**
   * A client may only be linked if it belongs to the same organization. A
   * foreign client and a non-existent one get the same answer.
   */
  private async assertClient(organizationId: string, clientId: string | null | undefined) {
    if (!clientId) {
      return;
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId },
      select: { id: true },
    });

    if (!client) {
      throw new BadRequestException({
        code: 'PROJECT_CLIENT_NOT_FOUND',
        message: 'Client not found in this organization.',
      });
    }
  }

  private static assertDateOrder(startDate: Date | null, dueDate: Date | null) {
    if (startDate && dueDate && dueDate < startDate) {
      throw new BadRequestException({
        code: 'INVALID_PROJECT_DATES',
        message: 'dueDate must be on or after startDate.',
      });
    }
  }

  async list(organizationId: string, query: QueryProjectsDto): Promise<Paginated<ProjectListItem>> {
    const { page, limit, search, status, priority, clientId, memberId, sortBy, sortOrder } = query;

    const where = {
      // Always present and never taken from the request: the tenant boundary.
      // It also scopes clientId and memberId, so a foreign id simply matches nothing.
      organizationId,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(clientId ? { clientId } : {}),
      ...(memberId ? { members: { some: { userId: memberId } } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { code: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    // Counts come from the same query as the rows: no per-row round trips, and
    // neither member nor task records are ever loaded for a list.
    const [rows, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        select: {
          ...BASE_SELECT,
          _count: {
            select: { members: { where: currentMembers(organizationId) }, tasks: true },
          },
        },
        orderBy: orderByFor(sortBy, sortOrder),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        ...toBase(row),
        membersCount: row._count.members,
        tasksCount: row._count.tasks,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(organizationId: string, id: string): Promise<ProjectDetail> {
    const row = await this.prisma.project.findFirst({
      where: { id, organizationId },
      select: {
        ...BASE_SELECT,
        members: {
          where: currentMembers(organizationId),
          select: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
          orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
        },
      },
    });

    if (!row) {
      throw ProjectsService.notFound();
    }

    return {
      ...toBase(row),
      members: row.members.map(({ user }) => ({
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      })),
      tasks: await this.taskSummary(row.id),
    };
  }

  /** Real counts only. Tasks arrive in phase 8; until then every number is zero. */
  private async taskSummary(projectId: string): Promise<ProjectTaskSummary> {
    const groups = await this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { _all: true },
    });

    const count = (status: string) =>
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

  /**
   * Creates a project with the next code of its organization.
   *
   * The code comes from `Organization.projectCodeSequence`, incremented in the
   * same transaction as the insert. The increment takes a row lock, so
   * concurrent creates queue behind each other and always receive distinct
   * numbers; and because the counter never goes down, deleting a project never
   * frees its code for reuse.
   *
   * A collision is only possible if a code was written outside this path. The
   * transaction then rolls back, and its increment with it, so the counter is
   * advanced past the taken number before trying again, a bounded number of times.
   */
  async create(organizationId: string, dto: CreateProjectDto): Promise<ProjectDetail> {
    await this.assertClient(organizationId, dto.clientId);

    const startDate = dto.startDate === undefined ? null : parseDate(dto.startDate);
    const dueDate = dto.dueDate === undefined ? null : parseDate(dto.dueDate);

    ProjectsService.assertDateOrder(startDate, dueDate);

    const data = {
      name: dto.name,
      description: dto.description ?? null,
      clientId: dto.clientId ?? null,
      // Omitted when absent so the schema defaults apply: PLANNING and MEDIUM.
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.priority ? { priority: dto.priority } : {}),
      startDate,
      dueDate,
    };

    for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt += 1) {
      try {
        const { id } = await this.prisma.$transaction(async (tx) => {
          const { projectCodeSequence } = await tx.organization.update({
            where: { id: organizationId },
            data: { projectCodeSequence: { increment: 1 } },
            select: { projectCodeSequence: true },
          });

          return tx.project.create({
            data: { ...data, organizationId, code: formatProjectCode(projectCodeSequence) },
            select: { id: true },
          });
        });

        return await this.findOne(organizationId, id);
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }

        await this.prisma.organization.update({
          where: { id: organizationId },
          data: { projectCodeSequence: { increment: 1 } },
        });
        this.logger.warn(
          `Project code collision in organization ${organizationId} (attempt ${attempt}); skipping ahead.`,
        );
      }
    }

    throw new InternalServerErrorException({
      code: 'PROJECT_CODE_GENERATION_FAILED',
      message: 'Could not generate a project code. Try again.',
    });
  }

  async update(organizationId: string, id: string, dto: UpdateProjectDto): Promise<ProjectDetail> {
    const current = await this.requireProject(organizationId, id);

    if (dto.clientId !== undefined) {
      await this.assertClient(organizationId, dto.clientId);
    }

    // Validated against the merged result: moving only one date must still
    // respect the one that stays.
    const startDate = dto.startDate === undefined ? current.startDate : parseDate(dto.startDate);
    const dueDate = dto.dueDate === undefined ? current.dueDate : parseDate(dto.dueDate);

    ProjectsService.assertDateOrder(startDate, dueDate);

    await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.startDate !== undefined ? { startDate } : {}),
        ...(dto.dueDate !== undefined ? { dueDate } : {}),
      },
    });

    return this.findOne(organizationId, id);
  }

  /**
   * Deletes a project that has no tasks.
   *
   * The condition is part of the DELETE itself rather than a separate count, so
   * a task cannot slip in between the check and the delete and be cascaded away.
   * Project members go with the project (cascade); users and memberships stay.
   */
  async remove(organizationId: string, id: string): Promise<void> {
    const { count } = await this.prisma.project.deleteMany({
      where: { id, organizationId, tasks: { none: {} } },
    });

    if (count > 0) {
      return;
    }

    // Nothing deleted: either it is not ours (404) or it has tasks (409).
    await this.requireProject(organizationId, id);

    throw new ConflictException({
      code: 'PROJECT_HAS_TASKS',
      message: 'This project has tasks and cannot be deleted.',
    });
  }

  async listMembers(organizationId: string, projectId: string): Promise<OrganizationMember[]> {
    await this.requireProject(organizationId, projectId);

    const rows = await this.prisma.projectMember.findMany({
      where: { projectId, ...currentMembers(organizationId) },
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            email: true,
            memberships: { where: { organizationId }, select: { role: true } },
          },
        },
      },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    });

    return rows.map(({ user }) => ({
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      email: user.email,
      // Guaranteed present by `currentMembers`.
      role: user.memberships[0].role,
    }));
  }

  /**
   * Assigns an organization member to a project.
   *
   * The unique constraint on (projectId, userId) is the duplicate check, so two
   * simultaneous assignments of the same person cannot both succeed.
   */
  async addMember(
    organizationId: string,
    projectId: string,
    userId: string,
  ): Promise<OrganizationMember> {
    await this.requireProject(organizationId, projectId);

    const member = await this.memberships.findMember(organizationId, userId);

    if (!member) {
      // Same answer for an unknown user and one who belongs to another organization.
      throw new BadRequestException({
        code: 'PROJECT_MEMBER_NOT_IN_ORGANIZATION',
        message: 'That user is not an active member of this organization.',
      });
    }

    try {
      await this.prisma.projectMember.create({ data: { projectId, userId } });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'PROJECT_MEMBER_ALREADY_EXISTS',
          message: 'That user is already a member of this project.',
        });
      }

      throw error;
    }

    return member;
  }

  /** Removes the assignment only. The user and their membership are untouched. */
  async removeMember(organizationId: string, projectId: string, userId: string): Promise<void> {
    await this.requireProject(organizationId, projectId);

    const { count } = await this.prisma.projectMember.deleteMany({ where: { projectId, userId } });

    if (count === 0) {
      throw new NotFoundException({
        code: 'PROJECT_MEMBER_NOT_FOUND',
        message: 'That user is not a member of this project.',
      });
    }
  }
}
