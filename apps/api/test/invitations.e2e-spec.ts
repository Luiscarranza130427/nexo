import { createHash, randomBytes } from 'node:crypto';
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
const NEW_PASSWORD = 'una-frase-de-acceso-nueva';

const PEOPLE = {
  OWNER: { email: 'inv-owner@novatec.test', firstName: 'Olivia', lastName: 'Torres' },
  ADMIN: { email: 'inv-admin@novatec.test', firstName: 'Adrián', lastName: 'Salas' },
  MANAGER: { email: 'inv-manager@novatec.test', firstName: 'Marta', lastName: 'Gómez' },
  MEMBER: { email: 'inv-member@novatec.test', firstName: 'Mateo', lastName: 'Ruiz' },
} as const;

type Role = keyof typeof PEOPLE;

const ROLES = Object.keys(PEOPLE) as Role[];

const OUTSIDER = 'inv-outsider@rival.test';

type Created = { id: string; email: string; role: string; expiresAt: string; token: string };

type InvitationBody = { id: string; email: string; status: string };

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('Invitations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordHash: string;
  let tokens: Record<Role, string>;
  let ids: Record<Role, string>;
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

  async function invite(email: string, role = 'MEMBER', actor: Role = 'OWNER'): Promise<Created> {
    const response = await request(server())
      .post('/team/invitations')
      .set(asRole(actor))
      .send({ email, role })
      .expect(201);

    return { ...response.body, token: String(response.body.inviteUrl).split('/invite/')[1] };
  }

  const accept = (body: Record<string, unknown>) =>
    request(server()).post('/invitations/accept').send(body);

  const revoke = (id: string, headers: Record<string, string>) =>
    request(server()).post(`/team/invitations/${id}/revoke`).set(headers);

  const statusOf = async (id: string) =>
    (await prisma.invitation.findUniqueOrThrow({ where: { id } })).status;

  const expire = (id: string) =>
    prisma.invitation.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });

  const ownMembership = (userId: string) =>
    prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: ownOrgId, userId } },
    });

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
    tokens = {} as Record<Role, string>;

    for (const role of ROLES) {
      const user = await prisma.user.create({ data: { ...PEOPLE[role], passwordHash } });

      ids[role] = user.id;
      await prisma.membership.create({ data: { organizationId: ownOrgId, userId: user.id, role } });
      tokens[role] = await signIn(PEOPLE[role].email, ownOrgId);
    }

    const outsider = await prisma.user.create({
      data: { email: OUTSIDER, firstName: 'Out', lastName: 'Sider', passwordHash },
    });

    await prisma.membership.create({
      data: { organizationId: rivalOrgId, userId: outsider.id, role: 'OWNER' },
    });
    outsiderToken = await signIn(OUTSIDER, rivalOrgId);
  });

  describe('POST /team/invitations', () => {
    it('creates an invitation whose link carries the only copy of the token', async () => {
      const before = Date.now();
      const response = await request(server())
        .post('/team/invitations')
        .set(asRole('OWNER'))
        .send({ email: '  Nueva.Persona@Example.COM ', role: 'MEMBER' })
        .expect(201);

      expect(Object.keys(response.body).sort()).toEqual([
        'email',
        'expiresAt',
        'id',
        'inviteUrl',
        'role',
      ]);
      expect(response.body.email).toBe('nueva.persona@example.com');
      expect(response.body.inviteUrl).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);

      const token = String(response.body.inviteUrl).split('/invite/')[1];
      const row = await prisma.invitation.findUniqueOrThrow({ where: { id: response.body.id } });

      expect(row.tokenHash).toBe(sha256(token));
      expect(JSON.stringify(row)).not.toContain(token);
      expect(row).toMatchObject({
        organizationId: ownOrgId,
        role: 'MEMBER',
        status: 'PENDING',
        invitedByUserId: ids.OWNER,
      });

      const days = (new Date(response.body.expiresAt).getTime() - before) / 86_400_000;

      expect(days).toBeGreaterThan(6.99);
      expect(days).toBeLessThan(7.01);
    });

    it('lets an OWNER invite admins, and an ADMIN only managers and members', async () => {
      await invite('gestor@example.com', 'MANAGER', 'ADMIN');
      await invite('admin@example.com', 'ADMIN', 'OWNER');

      const response = await request(server())
        .post('/team/invitations')
        .set(asRole('ADMIN'))
        .send({ email: 'otro-admin@example.com', role: 'ADMIN' })
        .expect(403);

      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('never accepts OWNER, an invalid email or an organizationId', async () => {
      const bodies = [
        { email: 'duena@example.com', role: 'OWNER' },
        { email: 'no-es-un-correo', role: 'MEMBER' },
        { email: 'ok@example.com', role: 'MEMBER', organizationId: rivalOrgId },
      ];

      for (const body of bodies) {
        await request(server())
          .post('/team/invitations')
          .set(asRole('OWNER'))
          .send(body)
          .expect(400);
      }

      expect(await prisma.invitation.count()).toBe(0);
    });

    it('blocks MANAGER and MEMBER', async () => {
      for (const role of ['MANAGER', 'MEMBER'] as Role[]) {
        await request(server())
          .post('/team/invitations')
          .set(asRole(role))
          .send({ email: 'x@example.com', role: 'MEMBER' })
          .expect(403);
      }
    });

    it('refuses someone who already belongs to the organization', async () => {
      const response = await request(server())
        .post('/team/invitations')
        .set(asRole('OWNER'))
        .send({ email: PEOPLE.MEMBER.email.toUpperCase(), role: 'MANAGER' })
        .expect(409);

      expect(response.body.code).toBe('USER_ALREADY_MEMBER');
    });

    it('refuses a second pending invitation, but replaces an expired one', async () => {
      const first = await invite('dup@example.com');
      const duplicate = await request(server())
        .post('/team/invitations')
        .set(asRole('ADMIN'))
        .send({ email: 'dup@example.com', role: 'MEMBER' })
        .expect(409);

      expect(duplicate.body.code).toBe('INVITATION_ALREADY_PENDING');

      await expire(first.id);
      await invite('dup@example.com');

      expect(await statusOf(first.id)).toBe('EXPIRED');
    });

    it('creates exactly one invitation under concurrent requests for one address', async () => {
      const responses = await Promise.all(
        [1, 2, 3].map(() =>
          request(server())
            .post('/team/invitations')
            .set(asRole('OWNER'))
            .send({ email: 'carrera@example.com', role: 'MEMBER' }),
        ),
      );

      expect(responses.map((response) => response.status).sort()).toEqual([201, 409, 409]);
      expect(await prisma.invitation.count({ where: { email: 'carrera@example.com' } })).toBe(1);
    });

    it('treats each organization independently', async () => {
      await invite('compartida@example.com');

      await request(server())
        .post('/team/invitations')
        .set(as(outsiderToken))
        .send({ email: 'compartida@example.com', role: 'MEMBER' })
        .expect(201);
    });
  });

  describe('GET /team/invitations', () => {
    it('lists effective statuses and the inviter, never the token or its fingerprint', async () => {
      const pending = await invite('pendiente@example.com');
      const expired = await invite('caducada@example.com');
      const revoked = await invite('revocada@example.com', 'MANAGER');

      await expire(expired.id);
      await revoke(revoked.id, asRole('OWNER')).expect(200);

      // A literal path, not mistaken for GET /team/:userId.
      const response = await request(server())
        .get('/team/invitations')
        .set(asRole('ADMIN'))
        .expect(200);
      const byEmail = Object.fromEntries(
        (response.body.data as InvitationBody[]).map((invitation) => [
          invitation.email,
          invitation,
        ]),
      );

      expect(response.body.meta.total).toBe(3);
      expect(byEmail['pendiente@example.com']).toMatchObject({
        status: 'PENDING',
        role: 'MEMBER',
        acceptedAt: null,
        revokedAt: null,
        invitedBy: { userId: ids.OWNER, firstName: 'Olivia', lastName: 'Torres' },
      });
      expect(byEmail['caducada@example.com'].status).toBe('EXPIRED');
      expect(byEmail['revocada@example.com'].status).toBe('REVOKED');

      const text = JSON.stringify(response.body);
      const stored = await prisma.invitation.findMany({ select: { tokenHash: true } });

      expect(text).not.toContain('tokenHash');

      for (const secret of [pending.token, expired.token, revoked.token]) {
        expect(text).not.toContain(secret);
      }

      for (const row of stored) {
        expect(text).not.toContain(row.tokenHash);
      }
    });

    it('filters by effective status and searches the email', async () => {
      await invite('pendiente@example.com');
      await expire((await invite('caducada@example.com')).id);

      const emails = async (query: string) => {
        const response = await request(server())
          .get(`/team/invitations?${query}`)
          .set(asRole('OWNER'))
          .expect(200);

        return (response.body.data as InvitationBody[]).map((invitation) => invitation.email);
      };

      expect(await emails('status=PENDING')).toEqual(['pendiente@example.com']);
      expect(await emails('status=EXPIRED')).toEqual(['caducada@example.com']);
      expect(await emails('status=REVOKED')).toEqual([]);
      expect(await emails('search=CADU')).toEqual(['caducada@example.com']);
    });

    it('is for OWNER and ADMIN, and only for their own organization', async () => {
      await invite('pendiente@example.com');

      await request(server()).get('/team/invitations').set(asRole('MANAGER')).expect(403);
      await request(server()).get('/team/invitations').set(asRole('MEMBER')).expect(403);

      const rival = await request(server())
        .get('/team/invitations')
        .set(as(outsiderToken))
        .expect(200);

      expect(rival.body.meta.total).toBe(0);
    });
  });

  describe('GET /invitations/:token', () => {
    it('describes a valid invitation publicly, and minimally', async () => {
      const created = await invite('nueva@example.com', 'MANAGER');
      const response = await request(server()).get(`/invitations/${created.token}`).expect(200);

      expect(response.body).toEqual({
        valid: true,
        status: 'PENDING',
        organizationName: 'NovaTec Test',
        email: 'nueva@example.com',
        role: 'MANAGER',
        expiresAt: created.expiresAt,
        accountExists: false,
      });
    });

    it('says when the invited address already has an account', async () => {
      const created = await invite(OUTSIDER);
      const response = await request(server()).get(`/invitations/${created.token}`).expect(200);

      expect(response.body.accountExists).toBe(true);
    });

    it('answers 404 for unknown and malformed tokens', async () => {
      const unknown = await request(server())
        .get(`/invitations/${randomBytes(32).toString('base64url')}`)
        .expect(404);

      expect(unknown.body.code).toBe('INVITATION_NOT_FOUND');
      await request(server()).get('/invitations/abc').expect(404);
    });

    it('reports expired, revoked and accepted invitations without their details', async () => {
      const expired = await invite('caducada@example.com');
      const revoked = await invite('revocada@example.com');
      const accepted = await invite('aceptada@example.com');

      await expire(expired.id);
      await revoke(revoked.id, asRole('OWNER')).expect(200);
      await accept({
        token: accepted.token,
        password: NEW_PASSWORD,
        firstName: 'Ana',
        lastName: 'Paz',
      }).expect(200);

      for (const [created, status] of [
        [expired, 'EXPIRED'],
        [revoked, 'REVOKED'],
        [accepted, 'ACCEPTED'],
      ] as const) {
        const response = await request(server()).get(`/invitations/${created.token}`).expect(200);

        expect(response.body).toEqual({ valid: false, status, organizationName: 'NovaTec Test' });
      }

      // Seeing an expired invitation settles it.
      expect(await statusOf(expired.id)).toBe('EXPIRED');
    });
  });

  describe('POST /invitations/accept', () => {
    it('creates the account of a new person, who can then sign in and use Nexo', async () => {
      const created = await invite('nueva.persona@example.com', 'MEMBER');
      const response = await accept({
        token: created.token,
        password: NEW_PASSWORD,
        firstName: ' Lucía ',
        lastName: 'Vega',
      }).expect(200);

      expect(response.body).toEqual({
        organization: { id: ownOrgId, name: 'NovaTec Test', slug: 'novatec-test' },
        email: 'nueva.persona@example.com',
        role: 'MEMBER',
      });

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: 'nueva.persona@example.com' },
      });

      expect(user).toMatchObject({ firstName: 'Lucía', lastName: 'Vega', status: 'ACTIVE' });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(await ownMembership(user.id)).toMatchObject({ role: 'MEMBER' });
      expect(
        await prisma.invitation.findUniqueOrThrow({ where: { id: created.id } }),
      ).toMatchObject({ status: 'ACCEPTED', acceptedByUserId: user.id });

      const login = await request(server())
        .post('/auth/login')
        .send({ email: 'nueva.persona@example.com', password: NEW_PASSWORD })
        .expect(200);
      const me = await request(server())
        .get('/auth/me')
        .set(as(login.body.accessToken))
        .expect(200);

      expect(me.body.organization.id).toBe(ownOrgId);
      expect(me.body.membership.role).toBe('MEMBER');
      await request(server()).get('/team').set(as(login.body.accessToken)).expect(200);
    });

    it('grants exactly the invited role', async () => {
      const created = await invite('gestora@example.com', 'MANAGER');

      await accept({
        token: created.token,
        password: NEW_PASSWORD,
        firstName: 'Gina',
        lastName: 'Luna',
      }).expect(200);

      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'gestora@example.com' } });

      expect((await ownMembership(user.id))?.role).toBe('MANAGER');
    });

    it('requires names and a policy-compliant password for a new account', async () => {
      const created = await invite('incompleta@example.com');

      const unnamed = await accept({ token: created.token, password: NEW_PASSWORD }).expect(400);
      const short = await accept({
        token: created.token,
        password: 'corta',
        firstName: 'Ana',
        lastName: 'Paz',
      }).expect(400);

      expect(unnamed.body.code).toBe('INVITATION_PROFILE_REQUIRED');
      expect(short.body.code).toBe('INVALID_PASSWORD');
      expect(await statusOf(created.id)).toBe('PENDING');
      expect(await prisma.user.count({ where: { email: 'incompleta@example.com' } })).toBe(0);
    });

    it('never lets a link take over an existing account', async () => {
      const before = await prisma.user.findUniqueOrThrow({ where: { email: OUTSIDER } });
      const created = await invite(OUTSIDER, 'ADMIN');

      const response = await accept({
        token: created.token,
        password: 'otra-contrasena-cualquiera',
        firstName: 'Intruso',
        lastName: 'Total',
      }).expect(401);

      const after = await prisma.user.findUniqueOrThrow({ where: { email: OUTSIDER } });

      expect(response.body.code).toBe('INVALID_CREDENTIALS');
      expect(after.passwordHash).toBe(before.passwordHash);
      expect(after.firstName).toBe('Out');
      expect(await ownMembership(before.id)).toBeNull();
      expect(await statusOf(created.id)).toBe('PENDING');
    });

    it('lets an existing person join with their own password, keeping their account as is', async () => {
      const before = await prisma.user.findUniqueOrThrow({ where: { email: OUTSIDER } });
      const created = await invite(OUTSIDER, 'MANAGER');

      await accept({ token: created.token, password: PASSWORD }).expect(200);

      const after = await prisma.user.findUniqueOrThrow({ where: { email: OUTSIDER } });

      expect(after.passwordHash).toBe(before.passwordHash);
      expect((await ownMembership(before.id))?.role).toBe('MANAGER');

      // The new organization shows up wherever the person picks one.
      const login = await request(server())
        .post('/auth/login')
        .send({ email: OUTSIDER, password: PASSWORD })
        .expect(409);

      expect(login.body.code).toBe('ORGANIZATION_REQUIRED');
      expect(login.body.organizations).toHaveLength(2);

      const switched = await request(server())
        .post('/auth/switch-organization')
        .set(as(outsiderToken))
        .send({ organizationId: ownOrgId })
        .expect(200);

      expect(switched.body.membership.role).toBe('MANAGER');
    });

    it('refuses expired, revoked and already accepted invitations', async () => {
      const expired = await invite('caducada@example.com');
      const revoked = await invite('revocada@example.com');
      const accepted = await invite('aceptada@example.com');
      const body = { password: NEW_PASSWORD, firstName: 'Ana', lastName: 'Paz' };

      await expire(expired.id);
      await revoke(revoked.id, asRole('ADMIN')).expect(200);
      await accept({ token: accepted.token, ...body }).expect(200);

      for (const [created, code] of [
        [expired, 'INVITATION_EXPIRED'],
        [revoked, 'INVITATION_REVOKED'],
        [accepted, 'INVITATION_ALREADY_ACCEPTED'],
      ] as const) {
        const response = await accept({ token: created.token, ...body }).expect(409);

        expect(response.body.code).toBe(code);
      }

      expect(await statusOf(expired.id)).toBe('EXPIRED');
      expect(await prisma.user.count({ where: { email: 'caducada@example.com' } })).toBe(0);
    });

    it('accepts exactly once under concurrent requests', async () => {
      const created = await invite('doble@example.com');
      const body = {
        token: created.token,
        password: NEW_PASSWORD,
        firstName: 'Ana',
        lastName: 'Paz',
      };

      const responses = await Promise.all([accept(body), accept(body)]);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'doble@example.com' } });

      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      expect(await prisma.user.count({ where: { email: 'doble@example.com' } })).toBe(1);
      expect(await prisma.membership.count({ where: { userId: user.id } })).toBe(1);
    });

    it('refuses an existing person who already belongs to the organization', async () => {
      const outsider = await prisma.user.findUniqueOrThrow({ where: { email: OUTSIDER } });
      const created = await invite(OUTSIDER);

      await prisma.membership.create({
        data: { organizationId: ownOrgId, userId: outsider.id, role: 'MEMBER' },
      });

      const response = await accept({ token: created.token, password: PASSWORD }).expect(409);

      expect(response.body.code).toBe('USER_ALREADY_MEMBER');
    });
  });

  describe('POST /team/invitations/:id/revoke', () => {
    it('lets OWNER and ADMIN revoke a pending invitation, which then stops working', async () => {
      const first = await invite('a@example.com');
      const second = await invite('b@example.com');

      const response = await revoke(first.id, asRole('OWNER')).expect(200);

      expect(response.body).toMatchObject({ id: first.id, status: 'REVOKED' });
      expect(response.body.revokedAt).not.toBeNull();

      await revoke(second.id, asRole('ADMIN')).expect(200);
      // Revoking twice is harmless.
      await revoke(first.id, asRole('OWNER')).expect(200);

      const attempt = await accept({
        token: first.token,
        password: NEW_PASSWORD,
        firstName: 'Ana',
        lastName: 'Paz',
      }).expect(409);

      expect(attempt.body.code).toBe('INVITATION_REVOKED');
    });

    it('blocks MANAGER and MEMBER', async () => {
      const created = await invite('a@example.com');

      await revoke(created.id, asRole('MANAGER')).expect(403);
      await revoke(created.id, asRole('MEMBER')).expect(403);
      expect(await statusOf(created.id)).toBe('PENDING');
    });

    it('refuses to revoke an accepted invitation', async () => {
      const created = await invite('a@example.com');

      await accept({
        token: created.token,
        password: NEW_PASSWORD,
        firstName: 'Ana',
        lastName: 'Paz',
      }).expect(200);

      const response = await revoke(created.id, asRole('OWNER')).expect(409);

      expect(response.body.code).toBe('INVITATION_ALREADY_ACCEPTED');
    });

    it('keeps another organization out', async () => {
      const created = await invite('a@example.com');

      const foreign = await revoke(created.id, as(outsiderToken)).expect(404);

      expect(foreign.body.code).toBe('INVITATION_NOT_FOUND');
      expect(await statusOf(created.id)).toBe('PENDING');

      await revoke('00000000-0000-4000-8000-000000000000', asRole('OWNER')).expect(404);
    });
  });
});
