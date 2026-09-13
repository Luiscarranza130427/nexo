import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { PrismaService } from '../src/database/prisma.service.js';

const databaseUrl = process.env.DATABASE_URL ?? '';

if (!databaseUrl.includes('nexo_test')) {
  throw new Error(
    'Refusing to run end-to-end tests: DATABASE_URL does not point at nexo_test. ' +
      'These tests delete data.',
  );
}

const PASSWORD = 'an-e2e-test-passphrase';

const ACCOUNTS = {
  OWNER: 'tasks-owner@novatec.test',
  ADMIN: 'tasks-admin@novatec.test',
  MANAGER: 'tasks-manager@novatec.test',
  MEMBER: 'tasks-member@novatec.test',
} as const;

type Role = keyof typeof ACCOUNTS;

const OUTSIDER = 'tasks-outsider@rival.test';

type TaskBody = {
  id: string;
  title: string;
  status: string;
  priority: string;
  position: number;
  completedAt: string | null;
  assignee: { userId: string } | null;
  [key: string]: unknown;
};

type BoardBody = {
  limitPerColumn: number;
  columns: { status: string; total: number; tasks: TaskBody[] }[];
};

describe('Tasks (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Record<Role, string>;
  let userIds: Record<Role, string>;
  let outsiderToken: string;
  let outsiderId: string;
  let ownOrgId: string;
  let projectId: string;
  /** Same organization, but the MEMBER and MANAGER are not members of it. */
  let otherProjectId: string;
  let foreignProjectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const asRole = (role: Role) => ({ Authorization: `Bearer ${tokens[role]}` });
  const asOutsider = () => ({ Authorization: `Bearer ${outsiderToken}` });

  async function signIn(email: string): Promise<string> {
    const response = await request(server())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    return response.body.accessToken as string;
  }

  beforeEach(async () => {
    await prisma.task.deleteMany();
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await prisma.client.deleteMany();
    await prisma.session.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();

    const passwordHash = await new PasswordService().hash(PASSWORD);
    const own = await prisma.organization.create({
      data: { name: 'NovaTec Test', slug: 'novatec-test' },
    });
    const other = await prisma.organization.create({
      data: { name: 'Rival Corp', slug: 'rival-corp' },
    });

    ownOrgId = own.id;
    userIds = {} as Record<Role, string>;

    for (const role of ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'] as Role[]) {
      const user = await prisma.user.create({
        data: { email: ACCOUNTS[role], firstName: role, lastName: 'Tester', passwordHash },
      });

      userIds[role] = user.id;
      await prisma.membership.create({ data: { organizationId: own.id, userId: user.id, role } });
    }

    const outsider = await prisma.user.create({
      data: { email: OUTSIDER, firstName: 'Out', lastName: 'Sider', passwordHash },
    });

    outsiderId = outsider.id;
    await prisma.membership.create({
      data: { organizationId: other.id, userId: outsider.id, role: 'OWNER' },
    });

    projectId = (
      await prisma.project.create({
        data: { organizationId: own.id, name: 'Portal', code: 'NEX-001' },
      })
    ).id;
    otherProjectId = (
      await prisma.project.create({
        data: { organizationId: own.id, name: 'Interno', code: 'NEX-002' },
      })
    ).id;
    foreignProjectId = (
      await prisma.project.create({
        data: { organizationId: other.id, name: 'Rival', code: 'NEX-001' },
      })
    ).id;

    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: userIds.MANAGER },
        { projectId, userId: userIds.MEMBER },
      ],
    });

    tokens = {
      OWNER: await signIn(ACCOUNTS.OWNER),
      ADMIN: await signIn(ACCOUNTS.ADMIN),
      MANAGER: await signIn(ACCOUNTS.MANAGER),
      MEMBER: await signIn(ACCOUNTS.MEMBER),
    };
    outsiderToken = await signIn(OUTSIDER);
  });

  async function createTask(body: Record<string, unknown> = {}, role: Role = 'OWNER') {
    const response = await request(server())
      .post('/tasks')
      .set(asRole(role))
      .send({ projectId, title: 'Tarea', ...body })
      .expect(201);

    return response.body as TaskBody;
  }

  async function board(query = '', role: Role = 'OWNER'): Promise<BoardBody> {
    const response = await request(server())
      .get(`/tasks/board?projectId=${projectId}${query}`)
      .set(asRole(role))
      .expect(200);

    return response.body as BoardBody;
  }

  const column = (body: BoardBody, status: string) =>
    body.columns.find((candidate) => candidate.status === status) ?? {
      status,
      total: 0,
      tasks: [],
    };

  const titles = (body: BoardBody, status: string) =>
    column(body, status).tasks.map((task) => task.title);

  const move = (id: string, body: Record<string, unknown>, role: Role = 'OWNER') =>
    request(server()).patch(`/tasks/${id}/move`).set(asRole(role)).send(body);

  describe('GET /tasks', () => {
    it('requires authentication', async () => {
      await request(server()).get('/tasks').expect(401);
    });

    it('lists only tasks of the caller organization, without organizationId', async () => {
      await createTask({ title: 'Nuestra' });
      await prisma.task.create({
        data: {
          organizationId: (
            await prisma.organization.findUniqueOrThrow({ where: { slug: 'rival-corp' } })
          ).id,
          projectId: foreignProjectId,
          title: 'Secreta',
        },
      });

      const response = await request(server()).get('/tasks').set(asRole('OWNER')).expect(200);

      expect(response.body.data.map((task: TaskBody) => task.title)).toEqual(['Nuestra']);
      expect(Object.keys(response.body.data[0]).sort()).toEqual([
        'assignee',
        'completedAt',
        'createdAt',
        'dueDate',
        'id',
        'position',
        'priority',
        'project',
        'startDate',
        'status',
        'title',
        'updatedAt',
      ]);
      expect(response.body.data[0].project).toEqual({
        id: projectId,
        code: 'NEX-001',
        name: 'Portal',
      });
    });

    it('limits a MEMBER to tasks of projects they belong to', async () => {
      await createTask({ title: 'Del portal' });
      await createTask({ title: 'Interna', projectId: otherProjectId });

      const member = await request(server()).get('/tasks').set(asRole('MEMBER')).expect(200);
      const manager = await request(server()).get('/tasks').set(asRole('MANAGER')).expect(200);

      expect(member.body.data.map((task: TaskBody) => task.title)).toEqual(['Del portal']);
      expect(manager.body.meta.total).toBe(2);
    });

    it('filters by project, status, priority, assignee and due dates', async () => {
      await createTask({
        title: 'A',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueDate: '2026-10-05',
      });
      await createTask({ title: 'B', assigneeId: userIds.MEMBER, dueDate: '2026-11-20' });
      await createTask({ title: 'C', projectId: otherProjectId });

      const names = async (query: string) => {
        const response = await request(server())
          .get(`/tasks?${query}`)
          .set(asRole('OWNER'))
          .expect(200);

        return response.body.data.map((task: TaskBody) => task.title).sort();
      };

      expect(await names(`projectId=${otherProjectId}`)).toEqual(['C']);
      expect(await names('status=IN_PROGRESS')).toEqual(['A']);
      expect(await names('priority=HIGH')).toEqual(['A']);
      expect(await names(`assigneeId=${userIds.MEMBER}`)).toEqual(['B']);
      expect(await names('dueFrom=2026-10-01&dueTo=2026-10-31')).toEqual(['A']);
      expect(await names('dueFrom=2026-11-20')).toEqual(['B']);
    });

    it('rejects a due range that ends before it starts', async () => {
      const response = await request(server())
        .get('/tasks?dueFrom=2026-10-10&dueTo=2026-10-01')
        .set(asRole('OWNER'))
        .expect(400);

      expect(response.body.code).toBe('INVALID_TASK_DATES');
    });

    it('searches title and description case-insensitively', async () => {
      await createTask({ title: 'Diseñar LOGIN', description: 'Pantalla de acceso' });
      await createTask({ title: 'Otra' });

      for (const search of ['login', 'ACCESO']) {
        const response = await request(server())
          .get(`/tasks?search=${encodeURIComponent(search)}`)
          .set(asRole('OWNER'))
          .expect(200);

        expect(response.body.data.map((task: TaskBody) => task.title)).toEqual(['Diseñar LOGIN']);
      }
    });

    it('paginates with a default page size of 20', async () => {
      await prisma.task.createMany({
        data: Array.from({ length: 25 }, (_, index) => ({
          organizationId: ownOrgId,
          projectId,
          title: `Bulk ${index}`,
          position: (index + 1) * 1000,
        })),
      });

      const first = await request(server()).get('/tasks').set(asRole('OWNER')).expect(200);
      const second = await request(server()).get('/tasks?page=2').set(asRole('OWNER')).expect(200);

      expect(first.body.data).toHaveLength(20);
      expect(first.body.meta).toEqual({ page: 1, limit: 20, total: 25, totalPages: 2 });
      expect(second.body.data).toHaveLength(5);
    });

    it('rejects unknown sort fields and oversized pages', async () => {
      await request(server()).get('/tasks?sortBy=organizationId').set(asRole('OWNER')).expect(400);
      await request(server()).get('/tasks?limit=101').set(asRole('OWNER')).expect(400);
    });
  });

  describe('GET /tasks/:id', () => {
    it('returns the detail with description, project and assignee', async () => {
      const task = await createTask({
        title: 'Detalle',
        description: 'Con descripción',
        assigneeId: userIds.MEMBER,
      });

      const response = await request(server())
        .get(`/tasks/${task.id}`)
        .set(asRole('MEMBER'))
        .expect(200);

      expect(response.body.description).toBe('Con descripción');
      expect(response.body.project.code).toBe('NEX-001');
      expect(response.body.assignee).toEqual({
        userId: userIds.MEMBER,
        firstName: 'MEMBER',
        lastName: 'Tester',
        avatarUrl: null,
      });
    });

    it('answers 404 for an unknown task, another organization, or outside a MEMBER’s projects', async () => {
      const internal = await createTask({ projectId: otherProjectId });

      await request(server())
        .get('/tasks/00000000-0000-4000-8000-000000000000')
        .set(asRole('OWNER'))
        .expect(404);
      await request(server()).get(`/tasks/${internal.id}`).set(asOutsider()).expect(404);

      const hidden = await request(server())
        .get(`/tasks/${internal.id}`)
        .set(asRole('MEMBER'))
        .expect(404);

      expect(hidden.body.code).toBe('TASK_NOT_FOUND');
    });
  });

  describe('POST /tasks', () => {
    it('allows OWNER, ADMIN and MANAGER, and blocks MEMBER', async () => {
      for (const role of ['OWNER', 'ADMIN', 'MANAGER'] as Role[]) {
        await createTask({ title: `Por ${role}` }, role);
      }

      await request(server())
        .post('/tasks')
        .set(asRole('MEMBER'))
        .send({ projectId, title: 'No' })
        .expect(403);
    });

    it('defaults to TODO and MEDIUM and appends to the end of the column', async () => {
      const first = await createTask({ title: 'Uno' });
      const second = await createTask({ title: 'Dos' });
      const third = await createTask({ title: 'Tres' });
      const elsewhere = await createTask({ title: 'Otra columna', status: 'IN_REVIEW' });

      expect([first.status, first.priority]).toEqual(['TODO', 'MEDIUM']);
      expect([first.position, second.position, third.position]).toEqual([1000, 2000, 3000]);
      expect(elsewhere.position).toBe(1000);
      expect(titles(await board(), 'TODO')).toEqual(['Uno', 'Dos', 'Tres']);
    });

    it('rejects position, completedAt and organizationId in the body', async () => {
      for (const extra of [
        { position: 1 },
        { completedAt: '2026-10-01' },
        { organizationId: ownOrgId },
      ]) {
        await request(server())
          .post('/tasks')
          .set(asRole('OWNER'))
          .send({ projectId, title: 'X', ...extra })
          .expect(400);
      }
    });

    it('answers 404 for a project of another organization', async () => {
      const response = await request(server())
        .post('/tasks')
        .set(asRole('OWNER'))
        .send({ projectId: foreignProjectId, title: 'X' })
        .expect(404);

      expect(response.body.code).toBe('TASK_PROJECT_NOT_FOUND');
    });

    it('only accepts an assignee who is a member of the project', async () => {
      const outside = await request(server())
        .post('/tasks')
        .set(asRole('OWNER'))
        .send({ projectId, title: 'X', assigneeId: outsiderId })
        .expect(400);
      const notInProject = await request(server())
        .post('/tasks')
        .set(asRole('OWNER'))
        .send({ projectId, title: 'X', assigneeId: userIds.ADMIN })
        .expect(400);
      const valid = await createTask({ assigneeId: userIds.MEMBER });

      expect(outside.body.code).toBe('TASK_ASSIGNEE_NOT_FOUND');
      expect(notInProject.body.code).toBe('TASK_ASSIGNEE_NOT_PROJECT_MEMBER');
      expect(valid.assignee?.userId).toBe(userIds.MEMBER);
    });

    it('refuses a due date before the start date', async () => {
      const response = await request(server())
        .post('/tasks')
        .set(asRole('OWNER'))
        .send({ projectId, title: 'X', startDate: '2026-10-10', dueDate: '2026-10-01' })
        .expect(400);

      expect(response.body.code).toBe('INVALID_TASK_DATES');
    });

    it('sets completedAt when a task is created already done', async () => {
      const done = await createTask({ status: 'DONE' });
      const open = await createTask();

      expect(done.completedAt).not.toBeNull();
      expect(open.completedAt).toBeNull();
    });

    it('gives concurrent creates in one column distinct positions', async () => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          request(server())
            .post('/tasks')
            .set(asRole('OWNER'))
            .send({ projectId, title: `Paralela ${index}` }),
        ),
      );

      const positions = responses.map((response) => response.body.position as number);

      expect(responses.every((response) => response.status === 201)).toBe(true);
      expect(new Set(positions).size).toBe(5);
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('lets OWNER, ADMIN and MANAGER edit any task', async () => {
      const task = await createTask();

      for (const role of ['OWNER', 'ADMIN', 'MANAGER'] as Role[]) {
        await request(server())
          .patch(`/tasks/${task.id}`)
          .set(asRole(role))
          .send({ title: `Editada por ${role}` })
          .expect(200);
      }
    });

    it('lets a MEMBER edit only their own task, and never reassign it', async () => {
      const mine = await createTask({ assigneeId: userIds.MEMBER });
      const theirs = await createTask({ assigneeId: userIds.MANAGER });
      const unassigned = await createTask();

      await request(server())
        .patch(`/tasks/${mine.id}`)
        .set(asRole('MEMBER'))
        .send({ title: 'Mía, editada', assigneeId: userIds.MEMBER })
        .expect(200);

      for (const id of [theirs.id, unassigned.id]) {
        const response = await request(server())
          .patch(`/tasks/${id}`)
          .set(asRole('MEMBER'))
          .send({ title: 'Ajena' })
          .expect(403);

        expect(response.body.code).toBe('FORBIDDEN');
      }

      for (const assigneeId of [userIds.MANAGER, null]) {
        await request(server())
          .patch(`/tasks/${mine.id}`)
          .set(asRole('MEMBER'))
          .send({ assigneeId })
          .expect(403);
      }
    });

    it('refuses to move a task to another project', async () => {
      const task = await createTask();

      await request(server())
        .patch(`/tasks/${task.id}`)
        .set(asRole('OWNER'))
        .send({ projectId: otherProjectId })
        .expect(400);
    });

    it('validates a new assignee and merged dates', async () => {
      const task = await createTask({ startDate: '2026-10-10' });

      const assignee = await request(server())
        .patch(`/tasks/${task.id}`)
        .set(asRole('MANAGER'))
        .send({ assigneeId: userIds.ADMIN })
        .expect(400);
      const dates = await request(server())
        .patch(`/tasks/${task.id}`)
        .set(asRole('MANAGER'))
        .send({ dueDate: '2026-10-01' })
        .expect(400);

      expect(assignee.body.code).toBe('TASK_ASSIGNEE_NOT_PROJECT_MEMBER');
      expect(dates.body.code).toBe('INVALID_TASK_DATES');
    });

    it('appends to the new column on a status change and maintains completedAt', async () => {
      const task = await createTask({ title: 'Cambia' });
      await createTask({ title: 'Ya revisada', status: 'DONE' });

      const done = await request(server())
        .patch(`/tasks/${task.id}`)
        .set(asRole('OWNER'))
        .send({ status: 'DONE' })
        .expect(200);

      expect(done.body.completedAt).not.toBeNull();
      expect(titles(await board(), 'DONE')).toEqual(['Ya revisada', 'Cambia']);

      const stillDone = await request(server())
        .patch(`/tasks/${task.id}`)
        .set(asRole('OWNER'))
        .send({ title: 'Cambia (renombrada)', status: 'DONE' })
        .expect(200);

      expect(stillDone.body.completedAt).toBe(done.body.completedAt);

      const reopened = await request(server())
        .patch(`/tasks/${task.id}`)
        .set(asRole('OWNER'))
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expect(reopened.body.completedAt).toBeNull();
    });

    it('rejects null for a title', async () => {
      const task = await createTask();

      await request(server())
        .patch(`/tasks/${task.id}`)
        .set(asRole('OWNER'))
        .send({ title: null })
        .expect(400);
    });
  });

  describe('PATCH /tasks/:id/move', () => {
    it('reorders within a column: last to first, then first to the middle', async () => {
      const a = await createTask({ title: 'A' });
      await createTask({ title: 'B' });
      const c = await createTask({ title: 'C' });

      await move(c.id, { status: 'TODO', beforeTaskId: a.id }).expect(200);
      expect(titles(await board(), 'TODO')).toEqual(['C', 'A', 'B']);

      await move(c.id, { status: 'TODO', afterTaskId: a.id }).expect(200);

      const after = await board();
      const positions = column(after, 'TODO').tasks.map((task) => task.position);

      expect(titles(after, 'TODO')).toEqual(['A', 'C', 'B']);
      expect([...positions].sort((x, y) => x - y)).toEqual(positions);
    });

    it('moves across the workflow and maintains completedAt', async () => {
      const task = await createTask({ title: 'Viaje' });
      const anchor = await createTask({ title: 'Ancla' });

      for (const status of ['IN_PROGRESS', 'IN_REVIEW', 'DONE']) {
        const response = await move(task.id, { status }).expect(200);

        expect(response.body.status).toBe(status);
        expect(response.body.completedAt === null).toBe(status !== 'DONE');
      }

      const back = await move(task.id, { status: 'TODO', beforeTaskId: anchor.id }).expect(200);

      expect(back.body.completedAt).toBeNull();
      expect(titles(await board(), 'TODO')).toEqual(['Viaje', 'Ancla']);
    });

    it('rejects neighbours that are missing, elsewhere or out of order', async () => {
      const a = await createTask({ title: 'A' });
      const b = await createTask({ title: 'B' });
      const other = await createTask({ title: 'Otra', status: 'IN_REVIEW' });
      const moving = await createTask({ title: 'M', status: 'DONE' });

      for (const body of [
        { status: 'TODO', afterTaskId: '00000000-0000-4000-8000-000000000000' },
        { status: 'TODO', afterTaskId: other.id },
        { status: 'TODO', afterTaskId: b.id, beforeTaskId: a.id },
      ]) {
        const response = await move(moving.id, body).expect(400);

        expect(response.body.code).toBe('INVALID_TASK_POSITION');
      }

      await move(moving.id, { status: 'TODO', position: 5 }).expect(400);
    });

    it('renormalizes a column once repeated insertions exhaust the gap', async () => {
      const a = await createTask({ title: 'A' });
      await createTask({ title: 'B' });
      const inserted: string[] = [];

      for (let index = 1; index <= 12; index += 1) {
        const task = await createTask({ title: `T${index}`, status: 'IN_REVIEW' });

        await move(task.id, { status: 'TODO', afterTaskId: a.id }).expect(200);
        inserted.unshift(`T${index}`);
      }

      const after = await board();
      const positions = column(after, 'TODO').tasks.map((task) => task.position);

      expect(titles(after, 'TODO')).toEqual(['A', ...inserted, 'B']);
      expect(new Set(positions).size).toBe(positions.length);
      expect([...positions].sort((x, y) => x - y)).toEqual(positions);
    });

    it('keeps positions distinct under concurrent moves into one column', async () => {
      const tasks = await Promise.all(
        Array.from({ length: 5 }, (_, index) => createTask({ title: `C${index}` })),
      );

      const responses = await Promise.all(
        tasks.map((task) => move(task.id, { status: 'IN_PROGRESS' })),
      );
      const positions = column(await board(), 'IN_PROGRESS').tasks.map((task) => task.position);

      expect(responses.every((response) => response.status === 200)).toBe(true);
      expect(positions).toHaveLength(5);
      expect(new Set(positions).size).toBe(5);
    });

    it('lets a MEMBER move their own task but not someone else’s', async () => {
      const mine = await createTask({ assigneeId: userIds.MEMBER });
      const theirs = await createTask({ assigneeId: userIds.MANAGER });

      await move(mine.id, { status: 'IN_PROGRESS' }, 'MEMBER').expect(200);
      await move(theirs.id, { status: 'IN_PROGRESS' }, 'MEMBER').expect(403);
      await move(theirs.id, { status: 'IN_PROGRESS' }, 'MANAGER').expect(200);
    });
  });

  describe('GET /tasks/board', () => {
    it('groups open tasks by column with real totals, leaving CANCELLED off', async () => {
      await createTask({ title: 'Hacer' });
      await createTask({ title: 'Haciendo', status: 'IN_PROGRESS' });
      await createTask({ title: 'Cancelada', status: 'CANCELLED' });

      const body = await board();

      expect(body.limitPerColumn).toBe(200);
      expect(body.columns.map((candidate) => candidate.status)).toEqual([
        'TODO',
        'IN_PROGRESS',
        'IN_REVIEW',
        'DONE',
      ]);
      expect(column(body, 'TODO').total).toBe(1);
      expect(JSON.stringify(body)).not.toContain('Cancelada');
    });

    it('applies search, priority and assignee filters', async () => {
      await createTask({ title: 'Urgente', priority: 'URGENT' });
      await createTask({ title: 'Asignada', assigneeId: userIds.MEMBER });

      expect(titles(await board('&priority=URGENT'), 'TODO')).toEqual(['Urgente']);
      expect(titles(await board(`&assigneeId=${userIds.MEMBER}`), 'TODO')).toEqual(['Asignada']);
      expect(titles(await board('&search=urgen'), 'TODO')).toEqual(['Urgente']);
    });

    it('refuses a MEMBER who is not in the project and another organization', async () => {
      await request(server())
        .get(`/tasks/board?projectId=${otherProjectId}`)
        .set(asRole('MEMBER'))
        .expect(403);

      const foreign = await request(server())
        .get(`/tasks/board?projectId=${projectId}`)
        .set(asOutsider())
        .expect(404);

      expect(foreign.body.code).toBe('TASK_PROJECT_NOT_FOUND');
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('allows OWNER and ADMIN, and blocks MANAGER and MEMBER', async () => {
      const keep = await createTask({ assigneeId: userIds.MEMBER });

      for (const role of ['MANAGER', 'MEMBER'] as Role[]) {
        await request(server()).delete(`/tasks/${keep.id}`).set(asRole(role)).expect(403);
      }

      for (const role of ['OWNER', 'ADMIN'] as Role[]) {
        const task = await createTask();

        await request(server()).delete(`/tasks/${task.id}`).set(asRole(role)).expect(204);
      }

      expect(await prisma.task.findUnique({ where: { id: keep.id } })).not.toBeNull();
    });
  });

  describe('tenant isolation', () => {
    it('keeps a task invisible and untouchable from another organization', async () => {
      const task = await createTask({ title: 'Solo NovaTec' });

      const list = await request(server()).get('/tasks').set(asOutsider()).expect(200);

      expect(JSON.stringify(list.body)).not.toContain('Solo NovaTec');

      await request(server()).get(`/tasks/${task.id}`).set(asOutsider()).expect(404);
      await request(server())
        .patch(`/tasks/${task.id}`)
        .set(asOutsider())
        .send({ title: 'Hijacked' })
        .expect(404);
      await request(server())
        .patch(`/tasks/${task.id}/move`)
        .set(asOutsider())
        .send({ status: 'DONE' })
        .expect(404);
      await request(server()).delete(`/tasks/${task.id}`).set(asOutsider()).expect(404);

      const create = await request(server())
        .post('/tasks')
        .set(asOutsider())
        .send({ projectId, title: 'Intrusa' })
        .expect(404);

      expect(create.body.code).toBe('TASK_PROJECT_NOT_FOUND');
      expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).title).toBe(
        'Solo NovaTec',
      );
    });
  });
});
