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

const PEOPLE = {
  OWNER: { email: 'team-owner@novatec.test', firstName: 'Olivia', lastName: 'Torres' },
  ADMIN: { email: 'team-admin@novatec.test', firstName: 'Adrián', lastName: 'Salas' },
  MANAGER: { email: 'team-manager@novatec.test', firstName: 'Marta', lastName: 'Gómez' },
  MEMBER: { email: 'team-member@novatec.test', firstName: 'Mateo', lastName: 'Ruiz' },
} as const;

type Role = keyof typeof PEOPLE;

const ROLES = Object.keys(PEOPLE) as Role[];

const OUTSIDER = 'team-outsider@rival.test';

type MemberBody = { userId: string; email: string; role: string; projectsCount: number };

describe('Team (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordHash: string;
  let tokens: Record<Role, string>;
  let ids: Record<Role, string>;
  let outsiderId: string;
  let outsiderToken: string;
  let ownOrgId: string;
  let rivalOrgId: string;

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
    passwordHash = await new PasswordService().hash(PASSWORD);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const asRole = (role: Role) => as(tokens[role]);

  async function signIn(email: string, organizationId: string): Promise<string> {
    const response = await request(server())
      .post('/auth/login')
      .send({ email, password: PASSWORD, organizationId })
      .expect(200);

    return response.body.accessToken as string;
  }

  const membership = (organizationId: string, userId: string) =>
    prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });

  const roleOf = async (userId: string) => (await membership(ownOrgId, userId))?.role;

  const changeRole = (actor: Role, userId: string, role: string) =>
    request(server()).patch(`/team/${userId}/role`).set(asRole(actor)).send({ role });

  const remove = (actor: Role, userId: string) =>
    request(server()).delete(`/team/${userId}`).set(asRole(actor));

  beforeEach(async () => {
    await prisma.invitation.deleteMany();
    await prisma.task.deleteMany();
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await prisma.client.deleteMany();
    await prisma.session.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();

    ownOrgId = (
      await prisma.organization.create({ data: { name: 'NovaTec Test', slug: 'novatec-test' } })
    ).id;
    rivalOrgId = (
      await prisma.organization.create({ data: { name: 'Rival Corp', slug: 'rival-corp' } })
    ).id;

    ids = {} as Record<Role, string>;

    for (const role of ROLES) {
      const user = await prisma.user.create({ data: { ...PEOPLE[role], passwordHash } });

      ids[role] = user.id;
      await prisma.membership.create({ data: { organizationId: ownOrgId, userId: user.id, role } });
    }

    const outsider = await prisma.user.create({
      data: { email: OUTSIDER, firstName: 'Out', lastName: 'Sider', passwordHash },
    });

    outsiderId = outsider.id;
    await prisma.membership.create({
      data: { organizationId: rivalOrgId, userId: outsider.id, role: 'OWNER' },
    });
    // The member also works for the rival organization: removal must only touch this one.
    await prisma.membership.create({
      data: { organizationId: rivalOrgId, userId: ids.MEMBER, role: 'MEMBER' },
    });

    const portal = await prisma.project.create({
      data: { organizationId: ownOrgId, name: 'Portal', code: 'NEX-001' },
    });
    const internal = await prisma.project.create({
      data: { organizationId: ownOrgId, name: 'Interno', code: 'NEX-002' },
    });
    const rival = await prisma.project.create({
      data: { organizationId: rivalOrgId, name: 'Rival', code: 'NEX-001' },
    });

    await prisma.projectMember.createMany({
      data: [
        { projectId: portal.id, userId: ids.MANAGER },
        { projectId: portal.id, userId: ids.MEMBER },
        { projectId: internal.id, userId: ids.MANAGER },
        { projectId: rival.id, userId: ids.MEMBER },
      ],
    });

    await prisma.task.createMany({
      data: [
        {
          organizationId: ownOrgId,
          projectId: portal.id,
          title: 'Del miembro',
          assigneeId: ids.MEMBER,
          status: 'IN_PROGRESS',
          position: 1000,
        },
        {
          organizationId: ownOrgId,
          projectId: internal.id,
          title: 'Del gestor',
          assigneeId: ids.MANAGER,
          position: 1000,
        },
        {
          organizationId: ownOrgId,
          projectId: portal.id,
          title: 'Gestor en portal',
          assigneeId: ids.MANAGER,
          status: 'DONE',
          position: 2000,
        },
        {
          organizationId: rivalOrgId,
          projectId: rival.id,
          title: 'Rival',
          assigneeId: ids.MEMBER,
          position: 1000,
        },
      ],
    });

    tokens = {} as Record<Role, string>;

    for (const role of ROLES) {
      tokens[role] = await signIn(PEOPLE[role].email, ownOrgId);
    }

    outsiderToken = await signIn(OUTSIDER, rivalOrgId);
  });

  describe('GET /team', () => {
    it('requires authentication', async () => {
      await request(server()).get('/team').expect(401);
    });

    it('lists this organization only, with nothing sensitive, to every role', async () => {
      const response = await request(server()).get('/team').set(asRole('MEMBER')).expect(200);
      const data = response.body.data as MemberBody[];

      expect(response.body.meta).toEqual({ page: 1, limit: 20, total: 4, totalPages: 1 });
      expect(data.map((member) => member.email).sort()).toEqual(
        ROLES.map((role) => PEOPLE[role].email).sort(),
      );
      expect(Object.keys(data[0]).sort()).toEqual([
        'avatarUrl',
        'email',
        'firstName',
        'joinedAt',
        'lastName',
        'projectsCount',
        'role',
        'status',
        'userId',
      ]);

      const text = JSON.stringify(response.body);

      for (const hidden of ['passwordHash', 'refreshTokenHash', 'organizationId', OUTSIDER]) {
        expect(text).not.toContain(hidden);
      }
    });

    it('counts only the projects of this organization', async () => {
      const response = await request(server()).get('/team').set(asRole('OWNER')).expect(200);
      const counts = Object.fromEntries(
        (response.body.data as MemberBody[]).map((member) => [member.email, member.projectsCount]),
      );

      expect(counts[PEOPLE.MANAGER.email]).toBe(2);
      expect(counts[PEOPLE.MEMBER.email]).toBe(1);
      expect(counts[PEOPLE.OWNER.email]).toBe(0);
    });

    it('searches first name, last name and email, every word counting', async () => {
      const emails = async (search: string) => {
        const response = await request(server())
          .get(`/team?search=${encodeURIComponent(search)}`)
          .set(asRole('OWNER'))
          .expect(200);

        return (response.body.data as MemberBody[]).map((member) => member.email);
      };

      expect(await emails('marta')).toEqual([PEOPLE.MANAGER.email]);
      expect(await emails('Mateo Ruiz')).toEqual([PEOPLE.MEMBER.email]);
      expect(await emails('OWNER@novatec')).toEqual([PEOPLE.OWNER.email]);
      expect(await emails('Mateo Gómez')).toEqual([]);
    });

    it('filters by role and by account status', async () => {
      await prisma.user.update({ where: { id: ids.MANAGER }, data: { status: 'INACTIVE' } });

      const byRole = await request(server())
        .get('/team?role=ADMIN')
        .set(asRole('OWNER'))
        .expect(200);
      const byStatus = await request(server())
        .get('/team?status=INACTIVE')
        .set(asRole('OWNER'))
        .expect(200);

      expect((byRole.body.data as MemberBody[]).map((member) => member.email)).toEqual([
        PEOPLE.ADMIN.email,
      ]);
      expect((byStatus.body.data as MemberBody[]).map((member) => member.email)).toEqual([
        PEOPLE.MANAGER.email,
      ]);
    });

    it('sorts by role and paginates on the server', async () => {
      const first = await request(server())
        .get('/team?sortBy=role&sortOrder=asc&limit=2')
        .set(asRole('OWNER'))
        .expect(200);
      const second = await request(server())
        .get('/team?sortBy=role&sortOrder=asc&limit=2&page=2')
        .set(asRole('OWNER'))
        .expect(200);

      expect((first.body.data as MemberBody[]).map((member) => member.role)).toEqual([
        'OWNER',
        'ADMIN',
      ]);
      expect(first.body.meta).toEqual({ page: 1, limit: 2, total: 4, totalPages: 2 });
      expect((second.body.data as MemberBody[]).map((member) => member.role)).toEqual([
        'MANAGER',
        'MEMBER',
      ]);
    });

    it('rejects unknown sort fields, filters and oversized pages', async () => {
      for (const query of ['sortBy=passwordHash', 'role=SUPERUSER', 'limit=101']) {
        await request(server()).get(`/team?${query}`).set(asRole('OWNER')).expect(400);
      }
    });
  });

  describe('GET /team/summary', () => {
    it('counts members by role within the caller organization', async () => {
      const own = await request(server()).get('/team/summary').set(asRole('MEMBER')).expect(200);
      const rival = await request(server()).get('/team/summary').set(as(outsiderToken)).expect(200);

      expect(own.body).toEqual({
        total: 4,
        byRole: { OWNER: 1, ADMIN: 1, MANAGER: 1, MEMBER: 1 },
      });
      expect(rival.body.total).toBe(2);
    });
  });

  describe('GET /team/:userId', () => {
    it('returns the profile with its projects and task counts in this organization', async () => {
      const response = await request(server())
        .get(`/team/${ids.MANAGER}`)
        .set(asRole('ADMIN'))
        .expect(200);

      expect(response.body).toMatchObject({
        userId: ids.MANAGER,
        firstName: 'Marta',
        role: 'MANAGER',
        status: 'ACTIVE',
        projectsCount: 2,
      });
      expect(response.body.projects.map((project: { name: string }) => project.name)).toEqual([
        'Interno',
        'Portal',
      ]);
      expect(Object.keys(response.body.projects[0]).sort()).toEqual([
        'code',
        'id',
        'name',
        'status',
      ]);
      expect(response.body.tasks).toEqual({
        total: 2,
        todo: 1,
        inProgress: 0,
        inReview: 0,
        done: 1,
        cancelled: 0,
      });
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    });

    it('leaves out work the person does for other organizations', async () => {
      const response = await request(server())
        .get(`/team/${ids.MEMBER}`)
        .set(asRole('OWNER'))
        .expect(200);

      expect(response.body.projects.map((project: { code: string }) => project.code)).toEqual([
        'NEX-001',
      ]);
      expect(response.body.projects[0].name).toBe('Portal');
      expect(response.body.tasks.total).toBe(1);
    });

    it('shows a MEMBER only the projects they share with the person', async () => {
      const response = await request(server())
        .get(`/team/${ids.MANAGER}`)
        .set(asRole('MEMBER'))
        .expect(200);

      expect(response.body.projects.map((project: { name: string }) => project.name)).toEqual([
        'Portal',
      ]);
      expect(response.body.tasks.total).toBe(1);
    });

    it('answers 404 for an unknown person or one from another organization', async () => {
      const unknown = await request(server())
        .get('/team/00000000-0000-4000-8000-000000000000')
        .set(asRole('OWNER'))
        .expect(404);

      expect(unknown.body.code).toBe('TEAM_MEMBER_NOT_FOUND');

      await request(server()).get(`/team/${outsiderId}`).set(asRole('OWNER')).expect(404);
      await request(server()).get('/team/not-a-uuid').set(asRole('OWNER')).expect(400);
    });
  });

  describe('PATCH /team/:userId/role', () => {
    it('lets an OWNER change a role, effective on the very next request', async () => {
      await request(server()).get('/team/invitations').set(asRole('MEMBER')).expect(403);

      const response = await changeRole('OWNER', ids.MEMBER, 'ADMIN').expect(200);

      expect(response.body).toMatchObject({ userId: ids.MEMBER, role: 'ADMIN' });
      // Same access token, no new session: roles are re-read from the database.
      await request(server()).get('/team/invitations').set(asRole('MEMBER')).expect(200);
    });

    it('lets an ADMIN turn a MEMBER into a MANAGER', async () => {
      await changeRole('ADMIN', ids.MEMBER, 'MANAGER').expect(200);

      expect(await roleOf(ids.MEMBER)).toBe('MANAGER');
    });

    it('keeps an ADMIN away from owners, other admins and ownership', async () => {
      const attempts: [string, string][] = [
        [ids.OWNER, 'MEMBER'],
        [ids.MEMBER, 'ADMIN'],
        [ids.MEMBER, 'OWNER'],
        [ids.ADMIN, 'MEMBER'],
      ];

      for (const [userId, role] of attempts) {
        const response = await changeRole('ADMIN', userId, role).expect(403);

        expect(response.body.code).toBe('FORBIDDEN');
      }

      expect(await roleOf(ids.OWNER)).toBe('OWNER');
      expect(await roleOf(ids.MEMBER)).toBe('MEMBER');
      expect(await roleOf(ids.ADMIN)).toBe('ADMIN');
    });

    it('blocks MANAGER and MEMBER', async () => {
      await changeRole('MANAGER', ids.MEMBER, 'MANAGER').expect(403);
      await changeRole('MEMBER', ids.MANAGER, 'MEMBER').expect(403);
    });

    it('protects the last active owner, not counting inactive ones', async () => {
      const response = await changeRole('OWNER', ids.OWNER, 'ADMIN').expect(409);

      expect(response.body.code).toBe('LAST_OWNER_REQUIRED');

      await prisma.membership.update({
        where: { organizationId_userId: { organizationId: ownOrgId, userId: ids.ADMIN } },
        data: { role: 'OWNER' },
      });
      await prisma.user.update({ where: { id: ids.ADMIN }, data: { status: 'INACTIVE' } });

      await changeRole('OWNER', ids.OWNER, 'ADMIN').expect(409);
      expect(await roleOf(ids.OWNER)).toBe('OWNER');
    });

    it('promotes to OWNER explicitly, without transferring ownership', async () => {
      await changeRole('OWNER', ids.ADMIN, 'OWNER').expect(200);

      // The promoter is still an owner; with two, one may step down.
      expect(await roleOf(ids.OWNER)).toBe('OWNER');

      await changeRole('OWNER', ids.OWNER, 'MEMBER').expect(200);
      expect(await roleOf(ids.ADMIN)).toBe('OWNER');
    });

    it('never ends with no owner when two owners demote each other at once', async () => {
      await changeRole('OWNER', ids.ADMIN, 'OWNER').expect(200);

      const responses = await Promise.all([
        changeRole('OWNER', ids.ADMIN, 'MEMBER'),
        changeRole('ADMIN', ids.OWNER, 'MEMBER'),
      ]);

      expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
      expect(
        await prisma.membership.count({ where: { organizationId: ownOrgId, role: 'OWNER' } }),
      ).toBe(1);
    });

    it('rejects an unknown role and people of another organization', async () => {
      await changeRole('OWNER', ids.MEMBER, 'SUPERUSER').expect(400);

      const foreign = await request(server())
        .patch(`/team/${ids.MANAGER}/role`)
        .set(as(outsiderToken))
        .send({ role: 'MEMBER' })
        .expect(404);

      expect(foreign.body.code).toBe('TEAM_MEMBER_NOT_FOUND');
      expect(await roleOf(ids.MANAGER)).toBe('MANAGER');
    });
  });

  describe('DELETE /team/:userId', () => {
    it('removes a person from this organization only, keeping the account and the work', async () => {
      const rivalToken = await signIn(PEOPLE.MEMBER.email, rivalOrgId);

      await remove('OWNER', ids.MEMBER).expect(204);

      expect(await membership(ownOrgId, ids.MEMBER)).toBeNull();
      expect(await membership(rivalOrgId, ids.MEMBER)).not.toBeNull();
      expect(await prisma.user.findUnique({ where: { id: ids.MEMBER } })).not.toBeNull();
      // Only the rival project membership is left.
      expect(await prisma.projectMember.count({ where: { userId: ids.MEMBER } })).toBe(1);

      const tasks = await prisma.task.findMany({ select: { title: true, assigneeId: true } });

      expect(tasks).toHaveLength(4);
      expect(tasks.find((task) => task.title === 'Del miembro')?.assigneeId).toBeNull();
      expect(tasks.find((task) => task.title === 'Rival')?.assigneeId).toBe(ids.MEMBER);

      // Access here ends at once; the other organization is untouched.
      await request(server()).get('/auth/me').set(asRole('MEMBER')).expect(401);
      await request(server()).get('/auth/me').set(as(rivalToken)).expect(200);

      const relogin = await request(server())
        .post('/auth/login')
        .send({ email: PEOPLE.MEMBER.email, password: PASSWORD, organizationId: ownOrgId })
        .expect(403);

      expect(relogin.body.code).toBe('INVALID_ORGANIZATION');
    });

    it('lets an ADMIN remove managers and members, never owners or admins', async () => {
      await remove('ADMIN', ids.OWNER).expect(403);
      await remove('ADMIN', ids.ADMIN).expect(403);
      await remove('ADMIN', ids.MANAGER).expect(204);

      expect(await membership(ownOrgId, ids.OWNER)).not.toBeNull();
      expect(await membership(ownOrgId, ids.MANAGER)).toBeNull();
    });

    it('blocks MANAGER and MEMBER', async () => {
      await remove('MANAGER', ids.MEMBER).expect(403);
      await remove('MEMBER', ids.MANAGER).expect(403);
    });

    it('refuses to remove the last active owner', async () => {
      const response = await remove('OWNER', ids.OWNER).expect(409);

      expect(response.body.code).toBe('LAST_OWNER_REQUIRED');
      expect(await membership(ownOrgId, ids.OWNER)).not.toBeNull();
    });

    it('lets an owner leave once another owner exists', async () => {
      await changeRole('OWNER', ids.ADMIN, 'OWNER').expect(200);
      await remove('OWNER', ids.OWNER).expect(204);

      await request(server()).get('/auth/me').set(asRole('OWNER')).expect(401);
      expect(await roleOf(ids.ADMIN)).toBe('OWNER');
    });

    it('answers 404 across organizations', async () => {
      await request(server()).delete(`/team/${ids.MANAGER}`).set(as(outsiderToken)).expect(404);
      await remove('OWNER', outsiderId).expect(404);

      expect(await membership(ownOrgId, ids.MANAGER)).not.toBeNull();
      expect(await membership(rivalOrgId, outsiderId)).not.toBeNull();
    });
  });
});
