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
  OWNER: 'projects-owner@novatec.test',
  ADMIN: 'projects-admin@novatec.test',
  MANAGER: 'projects-manager@novatec.test',
  MEMBER: 'projects-member@novatec.test',
} as const;

type Role = keyof typeof ACCOUNTS;

const ROLES: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'];

/** OWNER of the other organization; proves tenant isolation. */
const OUTSIDER = 'projects-outsider@rival.test';

type ProjectBody = { id: string; code: string; name: string; [key: string]: unknown };

describe('Projects (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Record<Role, string>;
  let userIds: Record<Role, string>;
  let outsiderToken: string;
  let outsiderId: string;
  let ownOrgId: string;
  let otherOrgId: string;
  let ownClientId: string;
  let otherClientId: string;

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

  async function signIn(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
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
    otherOrgId = other.id;
    userIds = {} as Record<Role, string>;

    for (const role of ROLES) {
      const user = await prisma.user.create({
        data: { email: ACCOUNTS[role], firstName: role, lastName: 'Tester', passwordHash },
      });

      userIds[role] = user.id;
      await prisma.membership.create({
        data: { organizationId: own.id, userId: user.id, role },
      });
    }

    const outsider = await prisma.user.create({
      data: { email: OUTSIDER, firstName: 'Out', lastName: 'Sider', passwordHash },
    });

    outsiderId = outsider.id;
    await prisma.membership.create({
      data: { organizationId: other.id, userId: outsider.id, role: 'OWNER' },
    });

    ownClientId = (
      await prisma.client.create({
        data: { organizationId: own.id, type: 'COMPANY', name: 'Acme SAC' },
      })
    ).id;
    otherClientId = (
      await prisma.client.create({
        data: { organizationId: other.id, type: 'COMPANY', name: 'Rival Client' },
      })
    ).id;

    tokens = {
      OWNER: await signIn(ACCOUNTS.OWNER),
      ADMIN: await signIn(ACCOUNTS.ADMIN),
      MANAGER: await signIn(ACCOUNTS.MANAGER),
      MEMBER: await signIn(ACCOUNTS.MEMBER),
    };
    outsiderToken = await signIn(OUTSIDER);
  });

  const asRole = (role: Role) => ({ Authorization: `Bearer ${tokens[role]}` });
  const asOutsider = () => ({ Authorization: `Bearer ${outsiderToken}` });

  async function createProject(role: Role, body: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post('/projects')
      .set(asRole(role))
      .send({ name: 'Proyecto', ...body })
      .expect(201);

    return response.body as ProjectBody;
  }

  /** A project of the other organization, written directly so it has its own code. */
  async function createForeignProject() {
    return prisma.project.create({
      data: { organizationId: otherOrgId, name: 'Secret Project', code: 'NEX-900' },
    });
  }

  describe('GET /projects', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/projects').expect(401);
    });

    it('returns only projects of the caller organization', async () => {
      await createProject('OWNER', { name: 'Nexo Web' });
      await createForeignProject();

      const response = await request(app.getHttpServer())
        .get('/projects')
        .set(asRole('OWNER'))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Nexo Web');
      expect(JSON.stringify(response.body)).not.toContain('Secret Project');
    });

    it('exposes counts and the client reference, never organizationId', async () => {
      const project = await createProject('OWNER', { clientId: ownClientId });

      await request(app.getHttpServer())
        .post(`/projects/${project.id}/members`)
        .set(asRole('OWNER'))
        .send({ userId: userIds.MEMBER })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/projects')
        .set(asRole('OWNER'))
        .expect(200);
      const row = response.body.data[0];

      expect(Object.keys(row).sort()).toEqual([
        'client',
        'code',
        'createdAt',
        'description',
        'dueDate',
        'id',
        'membersCount',
        'name',
        'priority',
        'startDate',
        'status',
        'tasksCount',
        'updatedAt',
      ]);
      expect(row.client).toEqual({ id: ownClientId, name: 'Acme SAC' });
      expect(row.membersCount).toBe(1);
      expect(row.tasksCount).toBe(0);
    });

    it('lets every role browse, including MEMBER', async () => {
      for (const role of ROLES) {
        await request(app.getHttpServer()).get('/projects').set(asRole(role)).expect(200);
      }
    });

    it('paginates on the server', async () => {
      await prisma.project.createMany({
        data: Array.from({ length: 12 }, (_, index) => ({
          organizationId: ownOrgId,
          name: `Bulk ${index}`,
          code: `BULK-${index}`,
        })),
      });

      const first = await request(app.getHttpServer())
        .get('/projects?page=1&limit=5')
        .set(asRole('OWNER'))
        .expect(200);
      const third = await request(app.getHttpServer())
        .get('/projects?page=3&limit=5')
        .set(asRole('OWNER'))
        .expect(200);

      expect(first.body.data).toHaveLength(5);
      expect(first.body.meta).toEqual({ page: 1, limit: 5, total: 12, totalPages: 3 });
      expect(third.body.data).toHaveLength(2);
    });

    it('searches name, code and description case-insensitively', async () => {
      const project = await createProject('OWNER', {
        name: 'Portal Clientes',
        description: 'Migración del CRM heredado',
      });
      await createProject('OWNER', { name: 'Otro' });

      for (const search of ['PORTAL', project.code.toLowerCase(), 'crm heredado']) {
        const response = await request(app.getHttpServer())
          .get(`/projects?search=${encodeURIComponent(search)}`)
          .set(asRole('OWNER'))
          .expect(200);

        expect(response.body.data, `search=${search}`).toHaveLength(1);
        expect(response.body.data[0].id).toBe(project.id);
      }
    });

    it('filters by status and priority', async () => {
      await createProject('OWNER', {
        name: 'Activo urgente',
        status: 'ACTIVE',
        priority: 'URGENT',
      });
      await createProject('OWNER', { name: 'En pausa', status: 'ON_HOLD', priority: 'LOW' });

      const active = await request(app.getHttpServer())
        .get('/projects?status=ACTIVE')
        .set(asRole('OWNER'))
        .expect(200);
      const low = await request(app.getHttpServer())
        .get('/projects?priority=LOW')
        .set(asRole('OWNER'))
        .expect(200);

      expect(active.body.data.map((p: ProjectBody) => p.name)).toEqual(['Activo urgente']);
      expect(low.body.data.map((p: ProjectBody) => p.name)).toEqual(['En pausa']);
    });

    it('filters by client, and a foreign client id matches nothing', async () => {
      await createProject('OWNER', { name: 'Con cliente', clientId: ownClientId });
      await createProject('OWNER', { name: 'Sin cliente' });

      const mine = await request(app.getHttpServer())
        .get(`/projects?clientId=${ownClientId}`)
        .set(asRole('OWNER'))
        .expect(200);
      const foreign = await request(app.getHttpServer())
        .get(`/projects?clientId=${otherClientId}`)
        .set(asRole('OWNER'))
        .expect(200);

      expect(mine.body.data.map((p: ProjectBody) => p.name)).toEqual(['Con cliente']);
      expect(foreign.body.data).toHaveLength(0);
    });

    it('filters by member', async () => {
      const staffed = await createProject('OWNER', { name: 'Con equipo' });
      await createProject('OWNER', { name: 'Sin equipo' });

      await request(app.getHttpServer())
        .post(`/projects/${staffed.id}/members`)
        .set(asRole('OWNER'))
        .send({ userId: userIds.MANAGER })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/projects?memberId=${userIds.MANAGER}`)
        .set(asRole('OWNER'))
        .expect(200);

      expect(response.body.data.map((p: ProjectBody) => p.name)).toEqual(['Con equipo']);
    });

    it('sorts by name, priority and due date, with undated projects last', async () => {
      await createProject('OWNER', { name: 'Beta', priority: 'LOW', dueDate: '2026-12-01' });
      await createProject('OWNER', { name: 'Alfa', priority: 'URGENT' });
      await createProject('OWNER', { name: 'Gamma', priority: 'MEDIUM', dueDate: '2026-10-01' });

      const names = async (query: string) => {
        const response = await request(app.getHttpServer())
          .get(`/projects?${query}`)
          .set(asRole('OWNER'))
          .expect(200);

        return response.body.data.map((p: ProjectBody) => p.name);
      };

      expect(await names('sortBy=name&sortOrder=asc')).toEqual(['Alfa', 'Beta', 'Gamma']);
      expect(await names('sortBy=priority&sortOrder=desc')).toEqual(['Alfa', 'Gamma', 'Beta']);
      expect(await names('sortBy=dueDate&sortOrder=asc')).toEqual(['Gamma', 'Beta', 'Alfa']);
      expect(await names('sortBy=dueDate&sortOrder=desc')).toEqual(['Beta', 'Gamma', 'Alfa']);
    });

    it('rejects unsupported sort fields and oversized pages', async () => {
      await request(app.getHttpServer())
        .get('/projects?sortBy=organizationId')
        .set(asRole('OWNER'))
        .expect(400);
      await request(app.getHttpServer())
        .get('/projects?limit=500')
        .set(asRole('OWNER'))
        .expect(400);
    });
  });

  describe('GET /projects/:id', () => {
    it('returns the detail with client, members and a real task summary', async () => {
      const project = await createProject('OWNER', { clientId: ownClientId });

      await request(app.getHttpServer())
        .post(`/projects/${project.id}/members`)
        .set(asRole('OWNER'))
        .send({ userId: userIds.ADMIN })
        .expect(201);
      await prisma.task.createMany({
        data: [
          { organizationId: ownOrgId, projectId: project.id, title: 'Uno', status: 'TODO' },
          { organizationId: ownOrgId, projectId: project.id, title: 'Dos', status: 'DONE' },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`/projects/${project.id}`)
        .set(asRole('MEMBER'))
        .expect(200);

      expect(response.body.client).toEqual({ id: ownClientId, name: 'Acme SAC' });
      expect(response.body.members).toEqual([
        { userId: userIds.ADMIN, firstName: 'ADMIN', lastName: 'Tester', avatarUrl: null },
      ]);
      expect(response.body.tasks).toEqual({
        total: 2,
        todo: 1,
        inProgress: 0,
        inReview: 0,
        done: 1,
        cancelled: 0,
      });
      expect(JSON.stringify(response.body)).not.toContain('organizationId');
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    });

    it('answers 404 for an unknown id', async () => {
      const response = await request(app.getHttpServer())
        .get('/projects/00000000-0000-4000-8000-000000000000')
        .set(asRole('OWNER'))
        .expect(404);

      expect(response.body.code).toBe('PROJECT_NOT_FOUND');
    });

    it('answers 404, not 403, for a project of another organization', async () => {
      const foreign = await createForeignProject();

      const response = await request(app.getHttpServer())
        .get(`/projects/${foreign.id}`)
        .set(asRole('OWNER'))
        .expect(404);

      expect(response.body.code).toBe('PROJECT_NOT_FOUND');
      expect(JSON.stringify(response.body)).not.toContain('Secret Project');
    });
  });

  describe('POST /projects', () => {
    it('allows OWNER, ADMIN and MANAGER, and blocks MEMBER', async () => {
      for (const role of ['OWNER', 'ADMIN', 'MANAGER'] as Role[]) {
        await createProject(role, { name: `Creado por ${role}` });
      }

      const response = await request(app.getHttpServer())
        .post('/projects')
        .set(asRole('MEMBER'))
        .send({ name: 'Nope' })
        .expect(403);

      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('defaults status to PLANNING and priority to MEDIUM', async () => {
      const project = await createProject('OWNER');

      expect(project.status).toBe('PLANNING');
      expect(project.priority).toBe('MEDIUM');
    });

    it('generates sequential codes per organization', async () => {
      expect((await createProject('OWNER')).code).toBe('NEX-001');
      expect((await createProject('OWNER')).code).toBe('NEX-002');

      // Another organization keeps its own sequence.
      const foreign = await request(app.getHttpServer())
        .post('/projects')
        .set(asOutsider())
        .send({ name: 'Rival' })
        .expect(201);

      expect(foreign.body.code).toBe('NEX-001');
    });

    it('never reuses the code of a deleted project', async () => {
      await createProject('OWNER');
      const second = await createProject('OWNER');

      expect(second.code).toBe('NEX-002');

      await request(app.getHttpServer())
        .delete(`/projects/${second.id}`)
        .set(asRole('OWNER'))
        .expect(204);

      expect((await createProject('OWNER')).code).toBe('NEX-003');
    });

    it('gives concurrent creates distinct codes', async () => {
      const responses = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          request(app.getHttpServer())
            .post('/projects')
            .set(asRole('OWNER'))
            .send({ name: `Concurrente ${index}` }),
        ),
      );

      expect(responses.map((response) => response.status)).toEqual(Array(6).fill(201));

      const codes = responses.map((response) => response.body.code as string).sort();

      expect(codes).toEqual(['NEX-001', 'NEX-002', 'NEX-003', 'NEX-004', 'NEX-005', 'NEX-006']);
    });

    it('skips a code already taken outside the generator', async () => {
      await prisma.project.create({
        data: { organizationId: ownOrgId, name: 'Importado', code: 'NEX-002' },
      });

      expect((await createProject('OWNER')).code).toBe('NEX-001');
      expect((await createProject('OWNER')).code).toBe('NEX-003');
    });

    it('rejects code, organizationId and unknown fields in the body', async () => {
      for (const extra of [{ code: 'NEX-777' }, { organizationId: otherOrgId }, { id: ownOrgId }]) {
        await request(app.getHttpServer())
          .post('/projects')
          .set(asRole('OWNER'))
          .send({ name: 'Intento', ...extra })
          .expect(400);
      }
    });

    it('refuses a client that does not exist or belongs to another organization', async () => {
      for (const clientId of ['00000000-0000-4000-8000-000000000000', otherClientId]) {
        const response = await request(app.getHttpServer())
          .post('/projects')
          .set(asRole('OWNER'))
          .send({ name: 'Cliente ajeno', clientId })
          .expect(400);

        expect(response.body.code).toBe('PROJECT_CLIENT_NOT_FOUND');
      }
    });

    it('refuses a due date before the start date, and impossible dates', async () => {
      const inverted = await request(app.getHttpServer())
        .post('/projects')
        .set(asRole('OWNER'))
        .send({ name: 'Fechas', startDate: '2026-10-10', dueDate: '2026-10-01' })
        .expect(400);

      expect(inverted.body.code).toBe('INVALID_PROJECT_DATES');

      await request(app.getHttpServer())
        .post('/projects')
        .set(asRole('OWNER'))
        .send({ name: 'Fechas', startDate: '2026-02-30' })
        .expect(400);
    });

    it('accepts the same start and due date and stores calendar dates at UTC midnight', async () => {
      const project = await createProject('OWNER', {
        startDate: '2026-10-01',
        dueDate: '2026-10-01',
      });

      expect(project.startDate).toBe('2026-10-01T00:00:00.000Z');
      expect(project.dueDate).toBe('2026-10-01T00:00:00.000Z');
    });

    it('rejects null for fields that cannot be null', async () => {
      for (const body of [
        { name: null },
        { name: 'X', status: null },
        { name: 'X', priority: null },
      ]) {
        await request(app.getHttpServer())
          .post('/projects')
          .set(asRole('OWNER'))
          .send(body)
          .expect(400);
      }
    });
  });

  describe('PATCH /projects/:id', () => {
    it('allows OWNER, ADMIN and MANAGER, and blocks MEMBER', async () => {
      const project = await createProject('OWNER');

      for (const role of ['OWNER', 'ADMIN', 'MANAGER'] as Role[]) {
        await request(app.getHttpServer())
          .patch(`/projects/${project.id}`)
          .set(asRole(role))
          .send({ name: `Editado por ${role}` })
          .expect(200);
      }

      await request(app.getHttpServer())
        .patch(`/projects/${project.id}`)
        .set(asRole('MEMBER'))
        .send({ name: 'Nope' })
        .expect(403);
    });

    it('updates partially and never changes the code', async () => {
      const project = await createProject('OWNER', { name: 'Original', priority: 'HIGH' });

      const response = await request(app.getHttpServer())
        .patch(`/projects/${project.id}`)
        .set(asRole('OWNER'))
        .send({ status: 'ACTIVE' })
        .expect(200);

      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.name).toBe('Original');
      expect(response.body.priority).toBe('HIGH');
      expect(response.body.code).toBe(project.code);
    });

    it('refuses to change the code or move the project to another organization', async () => {
      const project = await createProject('OWNER');

      for (const body of [{ code: 'NEX-999' }, { organizationId: otherOrgId }]) {
        await request(app.getHttpServer())
          .patch(`/projects/${project.id}`)
          .set(asRole('OWNER'))
          .send(body)
          .expect(400);
      }

      const row = await prisma.project.findUnique({ where: { id: project.id } });

      expect(row?.code).toBe(project.code);
      expect(row?.organizationId).toBe(ownOrgId);
    });

    it('answers 404 for a project of another organization and leaves it untouched', async () => {
      const foreign = await createForeignProject();

      await request(app.getHttpServer())
        .patch(`/projects/${foreign.id}`)
        .set(asRole('OWNER'))
        .send({ name: 'Hijacked' })
        .expect(404);

      expect((await prisma.project.findUnique({ where: { id: foreign.id } }))?.name).toBe(
        'Secret Project',
      );
    });

    it('validates a new client and lets null unlink it', async () => {
      const project = await createProject('OWNER', { clientId: ownClientId });

      const foreign = await request(app.getHttpServer())
        .patch(`/projects/${project.id}`)
        .set(asRole('OWNER'))
        .send({ clientId: otherClientId })
        .expect(400);

      expect(foreign.body.code).toBe('PROJECT_CLIENT_NOT_FOUND');

      const unlinked = await request(app.getHttpServer())
        .patch(`/projects/${project.id}`)
        .set(asRole('OWNER'))
        .send({ clientId: null })
        .expect(200);

      expect(unlinked.body.client).toBeNull();
    });

    it('validates dates against the value that stays unchanged', async () => {
      const project = await createProject('OWNER', { startDate: '2026-10-10' });

      const response = await request(app.getHttpServer())
        .patch(`/projects/${project.id}`)
        .set(asRole('OWNER'))
        .send({ dueDate: '2026-10-01' })
        .expect(400);

      expect(response.body.code).toBe('INVALID_PROJECT_DATES');
    });

    it('rejects null for a name', async () => {
      const project = await createProject('OWNER');

      await request(app.getHttpServer())
        .patch(`/projects/${project.id}`)
        .set(asRole('OWNER'))
        .send({ name: null })
        .expect(400);
    });
  });

  describe('DELETE /projects/:id', () => {
    it('allows OWNER and ADMIN', async () => {
      for (const role of ['OWNER', 'ADMIN'] as Role[]) {
        const project = await createProject('OWNER');

        await request(app.getHttpServer())
          .delete(`/projects/${project.id}`)
          .set(asRole(role))
          .expect(204);
      }
    });

    it('blocks MANAGER and MEMBER', async () => {
      const project = await createProject('OWNER');

      for (const role of ['MANAGER', 'MEMBER'] as Role[]) {
        const response = await request(app.getHttpServer())
          .delete(`/projects/${project.id}`)
          .set(asRole(role))
          .expect(403);

        expect(response.body.code).toBe('FORBIDDEN');
      }

      expect(await prisma.project.findUnique({ where: { id: project.id } })).not.toBeNull();
    });

    it('refuses to delete a project that has tasks', async () => {
      const project = await createProject('OWNER');

      await prisma.task.create({
        data: { organizationId: ownOrgId, projectId: project.id, title: 'Pendiente' },
      });

      const response = await request(app.getHttpServer())
        .delete(`/projects/${project.id}`)
        .set(asRole('OWNER'))
        .expect(409);

      expect(response.body.code).toBe('PROJECT_HAS_TASKS');
      expect(await prisma.project.findUnique({ where: { id: project.id } })).not.toBeNull();
      expect(await prisma.task.count()).toBe(1);
    });

    it('removes the assignments but keeps the users and their memberships', async () => {
      const project = await createProject('OWNER');

      await request(app.getHttpServer())
        .post(`/projects/${project.id}/members`)
        .set(asRole('OWNER'))
        .send({ userId: userIds.MEMBER })
        .expect(201);
      await request(app.getHttpServer())
        .delete(`/projects/${project.id}`)
        .set(asRole('OWNER'))
        .expect(204);

      expect(await prisma.projectMember.count()).toBe(0);
      expect(await prisma.user.findUnique({ where: { id: userIds.MEMBER } })).not.toBeNull();
      expect(
        await prisma.membership.count({
          where: { userId: userIds.MEMBER, organizationId: ownOrgId },
        }),
      ).toBe(1);
    });
  });

  describe('project members', () => {
    it('lists members with their organization role and nothing sensitive', async () => {
      const project = await createProject('OWNER');

      await request(app.getHttpServer())
        .post(`/projects/${project.id}/members`)
        .set(asRole('OWNER'))
        .send({ userId: userIds.MANAGER })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/projects/${project.id}/members`)
        .set(asRole('MEMBER'))
        .expect(200);

      expect(response.body).toEqual([
        {
          userId: userIds.MANAGER,
          firstName: 'MANAGER',
          lastName: 'Tester',
          avatarUrl: null,
          email: ACCOUNTS.MANAGER,
          role: 'MANAGER',
        },
      ]);
    });

    it('lets OWNER, ADMIN and MANAGER assign, and blocks MEMBER', async () => {
      const project = await createProject('OWNER');
      const assignees: [Role, Role][] = [
        ['OWNER', 'OWNER'],
        ['ADMIN', 'ADMIN'],
        ['MANAGER', 'MANAGER'],
      ];

      for (const [actor, assignee] of assignees) {
        await request(app.getHttpServer())
          .post(`/projects/${project.id}/members`)
          .set(asRole(actor))
          .send({ userId: userIds[assignee] })
          .expect(201);
      }

      await request(app.getHttpServer())
        .post(`/projects/${project.id}/members`)
        .set(asRole('MEMBER'))
        .send({ userId: userIds.MEMBER })
        .expect(403);
    });

    it('refuses a duplicate assignment', async () => {
      const project = await createProject('OWNER');
      const add = () =>
        request(app.getHttpServer())
          .post(`/projects/${project.id}/members`)
          .set(asRole('OWNER'))
          .send({ userId: userIds.MEMBER });

      await add().expect(201);
      const response = await add().expect(409);

      expect(response.body.code).toBe('PROJECT_MEMBER_ALREADY_EXISTS');
    });

    it('refuses a user from another organization or an unknown user', async () => {
      const project = await createProject('OWNER');

      for (const userId of [outsiderId, '00000000-0000-4000-8000-000000000000']) {
        const response = await request(app.getHttpServer())
          .post(`/projects/${project.id}/members`)
          .set(asRole('OWNER'))
          .send({ userId })
          .expect(400);

        expect(response.body.code).toBe('PROJECT_MEMBER_NOT_IN_ORGANIZATION');
      }
    });

    it('removes an assignment without touching the user or membership', async () => {
      const project = await createProject('OWNER');

      await request(app.getHttpServer())
        .post(`/projects/${project.id}/members`)
        .set(asRole('OWNER'))
        .send({ userId: userIds.MEMBER })
        .expect(201);
      await request(app.getHttpServer())
        .delete(`/projects/${project.id}/members/${userIds.MEMBER}`)
        .set(asRole('MANAGER'))
        .expect(204);

      const members = await request(app.getHttpServer())
        .get(`/projects/${project.id}/members`)
        .set(asRole('OWNER'))
        .expect(200);

      expect(members.body).toEqual([]);
      expect(await prisma.membership.count({ where: { userId: userIds.MEMBER } })).toBe(1);
    });

    it('answers 404 when removing someone who is not a member', async () => {
      const project = await createProject('OWNER');

      const response = await request(app.getHttpServer())
        .delete(`/projects/${project.id}/members/${userIds.ADMIN}`)
        .set(asRole('OWNER'))
        .expect(404);

      expect(response.body.code).toBe('PROJECT_MEMBER_NOT_FOUND');
    });
  });

  describe('tenant isolation', () => {
    it('keeps a project invisible and untouchable from another organization', async () => {
      const project = await createProject('OWNER', { name: 'Solo NovaTec' });

      await request(app.getHttpServer())
        .post(`/projects/${project.id}/members`)
        .set(asRole('OWNER'))
        .send({ userId: userIds.MEMBER })
        .expect(201);

      const server = app.getHttpServer();
      const list = await request(server).get('/projects').set(asOutsider()).expect(200);

      expect(JSON.stringify(list.body)).not.toContain('Solo NovaTec');

      await request(server).get(`/projects/${project.id}`).set(asOutsider()).expect(404);
      await request(server)
        .patch(`/projects/${project.id}`)
        .set(asOutsider())
        .send({ name: 'Hijacked' })
        .expect(404);
      await request(server).delete(`/projects/${project.id}`).set(asOutsider()).expect(404);
      await request(server).get(`/projects/${project.id}/members`).set(asOutsider()).expect(404);
      await request(server)
        .post(`/projects/${project.id}/members`)
        .set(asOutsider())
        .send({ userId: outsiderId })
        .expect(404);
      await request(server)
        .delete(`/projects/${project.id}/members/${userIds.MEMBER}`)
        .set(asOutsider())
        .expect(404);

      const row = await prisma.project.findUnique({ where: { id: project.id } });

      expect(row?.name).toBe('Solo NovaTec');
      expect(await prisma.projectMember.count({ where: { projectId: project.id } })).toBe(1);
    });
  });

  describe('GET /organization/members', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/organization/members').expect(401);
    });

    it('lists active members of the caller organization only, with safe fields', async () => {
      await prisma.user.update({
        where: { id: userIds.ADMIN },
        data: { status: 'INACTIVE' },
      });

      const response = await request(app.getHttpServer())
        .get('/organization/members')
        .set(asRole('MEMBER'))
        .expect(200);

      const emails = response.body.map((member: { email: string }) => member.email).sort();

      expect(emails).toEqual([ACCOUNTS.MANAGER, ACCOUNTS.MEMBER, ACCOUNTS.OWNER].sort());
      expect(Object.keys(response.body[0]).sort()).toEqual([
        'avatarUrl',
        'email',
        'firstName',
        'lastName',
        'role',
        'userId',
      ]);
      expect(JSON.stringify(response.body)).not.toContain(OUTSIDER);
    });
  });
});
