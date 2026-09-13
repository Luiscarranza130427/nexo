import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MembershipRole,
  Paginated,
  Priority,
  TaskBoard,
  TaskDetail,
  TaskListItem,
  TaskStatus,
} from '@nexo/types';
import { MembershipService } from '../auth/membership.service.js';
import type { AuthContext } from '../auth/types/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import type { BoardQueryDto } from './dto/board-query.dto.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { MoveTaskDto } from './dto/move-task.dto.js';
import type { QueryTasksDto, TaskSortField } from './dto/query-tasks.dto.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';
import {
  POSITION_GAP,
  completedAtFor,
  insertionIndex,
  normalizedPositions,
  positionAt,
  type Slot,
} from './task-rules.js';

/** Columns shown on the board, in order. Cancelled tasks stay off it. */
export const BOARD_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;

/** Upper bound per column. Beyond it the board would need virtualization. */
export const BOARD_LIMIT_PER_COLUMN = 200;

/** What a list row or a board card exposes. `organizationId` is never selected. */
const LIST_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  position: true,
  startDate: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, code: true, name: true } },
  assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

const DETAIL_SELECT = { ...LIST_SELECT, description: true } as const;

type ListRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  position: number;
  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: { id: string; code: string; name: string };
  assignee: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null;
};

/** The caller, with the role re-read from the database. */
type Actor = {
  userId: string;
  organizationId: string;
  role: MembershipRole;
};

/** Just enough of a task to authorize and validate a change to it. */
type TaskState = {
  id: string;
  projectId: string;
  status: TaskStatus;
  assigneeId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
};

type Filters = {
  search?: string;
  projectId?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  dueFrom?: string;
  dueTo?: string;
};

/** The two things a transaction needs here: the task delegate and a raw query for the lock. */
type Tx = Pick<PrismaService, 'task' | '$queryRaw'>;

const iso = (value: Date | null) => (value ? value.toISOString() : null);

function toListItem(row: ListRow): TaskListItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    position: row.position,
    startDate: iso(row.startDate),
    dueDate: iso(row.dueDate),
    completedAt: iso(row.completedAt),
    project: row.project,
    assignee: row.assignee
      ? {
          userId: row.assignee.id,
          firstName: row.assignee.firstName,
          lastName: row.assignee.lastName,
          avatarUrl: row.assignee.avatarUrl,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDetail(row: ListRow & { description: string | null }): TaskDetail {
  return { ...toListItem(row), description: row.description };
}

/** `YYYY-MM-DD` becomes UTC midnight; absent and `null` both mean "no date". */
function parseDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

/** The shared WHERE for every filter the list and the board accept. */
function filterWhere(filters: Filters) {
  const { search, projectId, status, priority, assigneeId, dueFrom, dueTo } = filters;

  return {
    ...(projectId ? { projectId } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(assigneeId ? { assigneeId } : {}),
    ...(dueFrom || dueTo
      ? {
          dueDate: {
            ...(dueFrom ? { gte: new Date(dueFrom) } : {}),
            ...(dueTo ? { lte: new Date(dueTo) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

/**
 * Tasks the actor may see. Everyone is bound to their organization; a MEMBER is
 * further bound to projects they belong to.
 */
function visibleWhere(actor: Actor) {
  return {
    organizationId: actor.organizationId,
    ...(actor.role === 'MEMBER'
      ? { project: { members: { some: { userId: actor.userId } } } }
      : {}),
  };
}

/** Explicit order clauses; `id` breaks ties so pages never overlap or skip rows. */
function orderByFor(field: TaskSortField, order: 'asc' | 'desc') {
  switch (field) {
    case 'startDate':
      return [{ startDate: { sort: order, nulls: 'last' as const } }, { id: 'asc' as const }];
    case 'dueDate':
      return [{ dueDate: { sort: order, nulls: 'last' as const } }, { id: 'asc' as const }];
    case 'position':
      return [{ position: order }, { id: 'asc' as const }];
    case 'title':
      return [{ title: order }, { id: 'asc' as const }];
    case 'priority':
      return [{ priority: order }, { id: 'asc' as const }];
    case 'updatedAt':
      return [{ updatedAt: order }, { id: 'asc' as const }];
    case 'createdAt':
      return [{ createdAt: order }, { id: 'asc' as const }];
  }
}

/**
 * Locks the project row for the rest of the transaction.
 *
 * Creates, moves and status changes inside one project queue behind each other,
 * so two people reordering a board cannot compute the same position; different
 * projects never wait on each other. A row lock has no equivalent in Prisma's
 * query API, which is why this is the one raw query in the module. Returns
 * `false` when the project no longer exists.
 */
async function lockProject(tx: Tx, projectId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Project" WHERE "id" = ${projectId}::uuid FOR UPDATE
  `;

  return rows.length > 0;
}

/**
 * Renumbers a column to 1000, 2000, 3000… with the moved task inserted at
 * `index`, and returns the moved task's new position. Only rows whose position
 * actually changes are written.
 */
async function renormalize(tx: Tx, column: readonly Slot[], index: number): Promise<number> {
  const positions = normalizedPositions(column.length + 1);

  for (const [offset, slot] of column.entries()) {
    const target = positions[offset < index ? offset : offset + 1];

    if (slot.position !== target) {
      await tx.task.update({ where: { id: slot.id }, data: { position: target } });
    }
  }

  return positions[index];
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberships: MembershipService,
  ) {}

  private static notFound(): NotFoundException {
    return new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task not found.' });
  }

  private static projectNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'TASK_PROJECT_NOT_FOUND',
      message: 'Project not found.',
    });
  }

  private static forbidden(): ForbiddenException {
    return new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient permissions.' });
  }

  private static assertDateOrder(startDate: Date | null, dueDate: Date | null) {
    if (startDate && dueDate && dueDate < startDate) {
      throw new BadRequestException({
        code: 'INVALID_TASK_DATES',
        message: 'dueDate must be on or after startDate.',
      });
    }
  }

  /** Re-reads the caller's role; a token never carries it. */
  private async resolveActor(auth: AuthContext): Promise<Actor> {
    const context = await this.memberships.resolve(auth.userId, auth.organizationId);

    if (!context) {
      throw TasksService.forbidden();
    }

    return {
      userId: auth.userId,
      organizationId: auth.organizationId,
      role: context.membership.role,
    };
  }

  private async requireProject(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });

    if (!project) {
      throw TasksService.projectNotFound();
    }
  }

  private async requireVisibleTask(actor: Actor, id: string): Promise<TaskState> {
    const task = await this.prisma.task.findFirst({
      where: { id, ...visibleWhere(actor) },
      select: {
        id: true,
        projectId: true,
        status: true,
        assigneeId: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
      },
    });

    if (!task) {
      throw TasksService.notFound();
    }

    return task;
  }

  /**
   * An assignee must be an active member of the organization and of the
   * project, so work cannot be handed to someone outside it.
   */
  private async assertAssignee(organizationId: string, projectId: string, userId: string) {
    const member = await this.memberships.findMember(organizationId, userId);

    if (!member) {
      throw new BadRequestException({
        code: 'TASK_ASSIGNEE_NOT_FOUND',
        message: 'That user is not an active member of this organization.',
      });
    }

    const inProject = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { id: true },
    });

    if (!inProject) {
      throw new BadRequestException({
        code: 'TASK_ASSIGNEE_NOT_PROJECT_MEMBER',
        message: 'That user is not a member of this project.',
      });
    }
  }

  async list(auth: AuthContext, query: QueryTasksDto): Promise<Paginated<TaskListItem>> {
    const actor = await this.resolveActor(auth);
    const { page, limit, sortBy, sortOrder, dueFrom, dueTo } = query;

    if (dueFrom && dueTo && new Date(dueTo) < new Date(dueFrom)) {
      throw new BadRequestException({
        code: 'INVALID_TASK_DATES',
        message: 'dueTo must be on or after dueFrom.',
      });
    }

    const where = { ...visibleWhere(actor), ...filterWhere(query) };

    const [rows, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        select: LIST_SELECT,
        orderBy: orderByFor(sortBy, sortOrder),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: rows.map(toListItem),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * One project's open tasks, by column. Four capped queries plus one count,
   * in parallel — the board never pages, and never loads descriptions.
   */
  async board(auth: AuthContext, query: BoardQueryDto): Promise<TaskBoard> {
    const actor = await this.resolveActor(auth);

    await this.requireProject(actor.organizationId, query.projectId);

    if (actor.role === 'MEMBER') {
      const membership = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: query.projectId, userId: actor.userId } },
        select: { id: true },
      });

      if (!membership) {
        throw TasksService.forbidden();
      }
    }

    const where = {
      organizationId: actor.organizationId,
      ...filterWhere({
        projectId: query.projectId,
        search: query.search,
        priority: query.priority,
        assigneeId: query.assigneeId,
      }),
    };

    const [counts, columns] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: { ...where, status: { in: [...BOARD_STATUSES] } },
        _count: { _all: true },
      }),
      Promise.all(
        BOARD_STATUSES.map((status) =>
          this.prisma.task.findMany({
            where: { ...where, status },
            select: LIST_SELECT,
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
            take: BOARD_LIMIT_PER_COLUMN,
          }),
        ),
      ),
    ]);

    return {
      limitPerColumn: BOARD_LIMIT_PER_COLUMN,
      columns: BOARD_STATUSES.map((status, index) => ({
        status,
        total: counts.find((group) => group.status === status)?._count._all ?? 0,
        tasks: columns[index].map(toListItem),
      })),
    };
  }

  async findOne(auth: AuthContext, id: string): Promise<TaskDetail> {
    const actor = await this.resolveActor(auth);
    const row = await this.prisma.task.findFirst({
      where: { id, ...visibleWhere(actor) },
      select: DETAIL_SELECT,
    });

    if (!row) {
      throw TasksService.notFound();
    }

    return toDetail(row);
  }

  /** Appends the task to the end of its column, inside the project lock. */
  async create(organizationId: string, dto: CreateTaskDto): Promise<TaskDetail> {
    await this.requireProject(organizationId, dto.projectId);

    if (dto.assigneeId) {
      await this.assertAssignee(organizationId, dto.projectId, dto.assigneeId);
    }

    const startDate = parseDate(dto.startDate);
    const dueDate = parseDate(dto.dueDate);

    TasksService.assertDateOrder(startDate, dueDate);

    const status = dto.status ?? 'TODO';

    const row = await this.prisma.$transaction(async (tx) => {
      if (!(await lockProject(tx, dto.projectId))) {
        throw TasksService.projectNotFound();
      }

      const last = await tx.task.findFirst({
        where: { projectId: dto.projectId, status },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      return tx.task.create({
        data: {
          organizationId,
          projectId: dto.projectId,
          title: dto.title,
          description: dto.description ?? null,
          status,
          ...(dto.priority ? { priority: dto.priority } : {}),
          assigneeId: dto.assigneeId ?? null,
          startDate,
          dueDate,
          position: (last?.position ?? 0) + POSITION_GAP,
          completedAt: completedAtFor(null, status, null),
        },
        select: DETAIL_SELECT,
      });
    });

    return toDetail(row);
  }

  /**
   * Edits a task. A MEMBER may edit only a task assigned to them, and may not
   * change who it is assigned to. A new status appends the task to the end of
   * that column and updates `completedAt`.
   */
  async update(auth: AuthContext, id: string, dto: UpdateTaskDto): Promise<TaskDetail> {
    const actor = await this.resolveActor(auth);
    const current = await this.requireVisibleTask(actor, id);
    const assigneeChanges = dto.assigneeId !== undefined && dto.assigneeId !== current.assigneeId;

    if (actor.role === 'MEMBER' && (current.assigneeId !== actor.userId || assigneeChanges)) {
      throw TasksService.forbidden();
    }

    if (assigneeChanges && dto.assigneeId) {
      await this.assertAssignee(actor.organizationId, current.projectId, dto.assigneeId);
    }

    const startDate = dto.startDate === undefined ? current.startDate : parseDate(dto.startDate);
    const dueDate = dto.dueDate === undefined ? current.dueDate : parseDate(dto.dueDate);

    TasksService.assertDateOrder(startDate, dueDate);

    const nextStatus =
      dto.status !== undefined && dto.status !== current.status ? dto.status : null;

    const row = await this.prisma.$transaction(async (tx) => {
      let placement: { status: TaskStatus; position: number; completedAt: Date | null } | null =
        null;

      if (nextStatus) {
        if (!(await lockProject(tx, current.projectId))) {
          throw TasksService.notFound();
        }

        const last = await tx.task.findFirst({
          where: { projectId: current.projectId, status: nextStatus, id: { not: id } },
          orderBy: { position: 'desc' },
          select: { position: true },
        });

        placement = {
          status: nextStatus,
          position: (last?.position ?? 0) + POSITION_GAP,
          completedAt: completedAtFor(current.status, nextStatus, current.completedAt),
        };
      }

      return tx.task.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
          ...(dto.startDate !== undefined ? { startDate } : {}),
          ...(dto.dueDate !== undefined ? { dueDate } : {}),
          ...placement,
        },
        select: DETAIL_SELECT,
      });
    });

    return toDetail(row);
  }

  /**
   * Moves a task within its column or into another one.
   *
   * Inside the project lock, the target column is read fresh, the neighbours
   * the client named are located in it, and the task takes the midpoint between
   * them — or, when there is no room left, the column is renormalized.
   */
  async move(auth: AuthContext, id: string, dto: MoveTaskDto): Promise<TaskDetail> {
    const actor = await this.resolveActor(auth);
    const current = await this.requireVisibleTask(actor, id);

    if (actor.role === 'MEMBER' && current.assigneeId !== actor.userId) {
      throw TasksService.forbidden();
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (!(await lockProject(tx, current.projectId))) {
        throw new ConflictException({
          code: 'TASK_MOVE_FAILED',
          message: 'The project is no longer available.',
        });
      }

      const column = await tx.task.findMany({
        where: { projectId: current.projectId, status: dto.status, id: { not: id } },
        select: { id: true, position: true },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      });

      const index = insertionIndex(column, dto.afterTaskId, dto.beforeTaskId);

      if (index === null) {
        throw new BadRequestException({
          code: 'INVALID_TASK_POSITION',
          message: 'The neighbouring tasks are not in that column, or not in that order.',
        });
      }

      const position = positionAt(column, index) ?? (await renormalize(tx, column, index));

      return tx.task.update({
        where: { id },
        data: {
          status: dto.status,
          position,
          completedAt: completedAtFor(current.status, dto.status, current.completedAt),
        },
        select: DETAIL_SELECT,
      });
    });

    return toDetail(row);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const { count } = await this.prisma.task.deleteMany({ where: { id, organizationId } });

    if (count === 0) {
      throw TasksService.notFound();
    }
  }
}
