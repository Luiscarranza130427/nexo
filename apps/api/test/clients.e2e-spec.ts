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

/** One account per role, so every permission can be checked against a real session. */
const ACCOUNTS = {
  OWNER: 'clients-owner@novatec.test',
  ADMIN: 'clients-admin@novatec.test',
  MANAGER: 'clients-manager@novatec.test',
  MEMBER: 'clients-member@novatec.test',
} as const;

type Role = keyof typeof ACCOUNTS;

/** Belongs to the *other* organization; used to prove tenant isolation. */
const OUTSIDER = 'clients-outsider@rival.test';

describe('Clients (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Record<Role, string>;
  let outsiderToken: string;
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

    for (const [role, email] of Object.entries(ACCOUNTS)) {
      const user = await prisma.user.create({
        data: { email, firstName: 'Test', lastName: role, passwordHash },
      });

      await prisma.membership.create({
        data: { organizationId: own.id, userId: user.id, role: role as Role },
      });
    }

    const outsider = await prisma.user.create({
      data: { email: OUTSIDER, firstName: 'Test', lastName: 'Outsider', passwordHash },
    });

    await prisma.membership.create({
      data: { organizationId: other.id, userId: outsider.id, role: 'OWNER' },
    });

    const ownClient = await prisma.client.create({
      data: {
        organizationId: own.id,
        type: 'COMPANY',
        name: 'Acme SAC',
        documentType: 'RUC',
        documentNumber: '20123456789',
        email: 'contacto@acme.test',
        phone: '+51 999 111 222',
        status: 'ACTIVE',
      },
    });
    const otherClient = await prisma.client.create({
      data: { organizationId: other.id, type: 'PERSON', name: 'Secret Client' },
    });

    ownClientId = ownClient.id;
    otherClientId = otherClient.id;

    tokens = {
      OWNER: await signIn(ACCOUNTS.OWNER),
      ADMIN: await signIn(ACCOUNTS.ADMIN),
      MANAGER: await signIn(ACCOUNTS.MANAGER),
      MEMBER: await signIn(ACCOUNTS.MEMBER),
    };
    outsiderToken = await signIn(OUTSIDER);
  });

  const asRole = (role: Role) => ({ Authorization: `Bearer ${tokens[role]}` });

  describe('GET /clients', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/clients').expect(401);
    });

    it('returns only clients of the caller organization', async () => {
      const response = await request(app.getHttpServer())
        .get('/clients')
        .set(asRole('OWNER'))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Acme SAC');
      // The other organization's client must be invisible, not merely filtered later.
      expect(JSON.stringify(response.body)).not.toContain('Secret Client');
    });

    it('never exposes organizationId', async () => {
      const response = await request(app.getHttpServer())
        .get('/clients')
        .set(asRole('OWNER'))
        .expect(200);

      expect(Object.keys(response.body.data[0]).sort()).toEqual([
        'address',
        'createdAt',
        'documentNumber',
        'documentType',
        'email',
        'id',
        'name',
        'phone',
        'status',
        'type',
        'updatedAt',
      ]);
    });

    it('lets every role browse, including MEMBER', async () => {
      for (const role of ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'] as Role[]) {
        await request(app.getHttpServer()).get('/clients').set(asRole(role)).expect(200);
      }
    });

    it('paginates on the server', async () => {
      await prisma.client.createMany({
        data: Array.from({ length: 14 }, (_, index) => ({
          organizationId: ownOrgId,
          type: 'COMPANY' as const,
          name: `Bulk ${String(index).padStart(2, '0')}`,
        })),
      });

      const first = await request(app.getHttpServer())
        .get('/clients?page=1&limit=10')
        .set(asRole('OWNER'))
        .expect(200);

      expect(first.body.data).toHaveLength(10);
      expect(first.body.meta).toEqual({ page: 1, limit: 10, total: 15, totalPages: 2 });

      const second = await request(app.getHttpServer())
        .get('/clients?page=2&limit=10')
        .set(asRole('OWNER'))
        .expect(200);

      expect(second.body.data).toHaveLength(5);
    });

    it('caps limit so the endpoint cannot be turned into a full export', async () => {
      await request(app.getHttpServer()).get('/clients?limit=500').set(asRole('OWNER')).expect(400);
    });

    it('searches by name, email, phone and document number, case-insensitively', async () => {
      const cases = ['acme', 'ACME', 'contacto@acme', '999 111', '2012345'];

      for (const search of cases) {
        const response = await request(app.getHttpServer())
          .get(`/clients?search=${encodeURIComponent(search)}`)
          .set(asRole('OWNER'))
          .expect(200);

        expect(response.body.data, `search=${search}`).toHaveLength(1);
      }
    });

    it('does not let search reach another organization', async () => {
      const response = await request(app.getHttpServer())
        .get('/clients?search=Secret')
        .set(asRole('OWNER'))
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });

    it('filters by status and type', async () => {
      await prisma.client.create({
        data: { organizationId: ownOrgId, type: 'PERSON', name: 'Juan Perez', status: 'PROSPECT' },
      });

      const active = await request(app.getHttpServer())
        .get('/clients?status=ACTIVE')
        .set(asRole('OWNER'))
        .expect(200);
      const people = await request(app.getHttpServer())
        .get('/clients?type=PERSON')
        .set(asRole('OWNER'))
        .expect(200);

      expect(active.body.data).toHaveLength(1);
      expect(active.body.data[0].name).toBe('Acme SAC');
      expect(people.body.data).toHaveLength(1);
      expect(people.body.data[0].name).toBe('Juan Perez');
    });

    it('rejects an unknown filter value', async () => {
      await request(app.getHttpServer())
        .get('/clients?status=DELETED')
        .set(asRole('OWNER'))
        .expect(400);
    });

    it('sorts by the requested field and direction', async () => {
      await prisma.client.create({
        data: { organizationId: ownOrgId, type: 'PERSON', name: 'Zulema' },
      });

      const ascending = await request(app.getHttpServer())
        .get('/clients?sortBy=name&sortOrder=asc')
        .set(asRole('OWNER'))
        .expect(200);

      expect(ascending.body.data.map((client: { name: string }) => client.name)).toEqual([
        'Acme SAC',
        'Zulema',
      ]);

      const descending = await request(app.getHttpServer())
        .get('/clients?sortBy=name&sortOrder=desc')
        .set(asRole('OWNER'))
        .expect(200);

      expect(descending.body.data[0].name).toBe('Zulema');
    });

    it('rejects an unsupported sort field', async () => {
      await request(app.getHttpServer())
        .get('/clients?sortBy=email')
        .set(asRole('OWNER'))
        .expect(400);
    });
  });

  describe('GET /clients/:id', () => {
    it('returns a client of the caller organization', async () => {
      const response = await request(app.getHttpServer())
        .get(`/clients/${ownClientId}`)
        .set(asRole('MEMBER'))
        .expect(200);

      expect(response.body.name).toBe('Acme SAC');
    });

    it('answers 404 for an unknown id', async () => {
      const response = await request(app.getHttpServer())
        .get('/clients/00000000-0000-4000-8000-000000000000')
        .set(asRole('OWNER'))
        .expect(404);

      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('answers 404 — not 403 — for a client of another organization', async () => {
      // 403 would confirm the id exists, which leaks across tenants.
      const response = await request(app.getHttpServer())
        .get(`/clients/${otherClientId}`)
        .set(asRole('OWNER'))
        .expect(404);

      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
      expect(JSON.stringify(response.body)).not.toContain('Secret Client');
    });
  });

  describe('POST /clients', () => {
    const payload = { type: 'COMPANY', name: 'Nueva Empresa SAC' };

    it('allows OWNER, ADMIN and MANAGER', async () => {
      for (const role of ['OWNER', 'ADMIN', 'MANAGER'] as Role[]) {
        await request(app.getHttpServer())
          .post('/clients')
          .set(asRole(role))
          .send({ ...payload, name: `${payload.name} ${role}` })
          .expect(201);
      }
    });

    it('blocks MEMBER', async () => {
      const response = await request(app.getHttpServer())
        .post('/clients')
        .set(asRole('MEMBER'))
        .send(payload)
        .expect(403);

      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('defaults status to PROSPECT', async () => {
      const response = await request(app.getHttpServer())
        .post('/clients')
        .set(asRole('OWNER'))
        .send(payload)
        .expect(201);

      expect(response.body.status).toBe('PROSPECT');
    });

    it('assigns the caller organization, ignoring any attempt to choose one', async () => {
      // forbidNonWhitelisted rejects the smuggled field outright.
      await request(app.getHttpServer())
        .post('/clients')
        .set(asRole('OWNER'))
        .send({ ...payload, organizationId: otherOrgId })
        .expect(400);

      // And a clean create lands in the caller's organization.
      const created = await request(app.getHttpServer())
        .post('/clients')
        .set(asRole('OWNER'))
        .send(payload)
        .expect(201);

      const row = await prisma.client.findUnique({
        where: { id: created.body.id },
        select: { organizationId: true },
      });

      expect(row?.organizationId).toBe(ownOrgId);
    });

    it('normalizes input before storing it', async () => {
      const response = await request(app.getHttpServer())
        .post('/clients')
        .set(asRole('OWNER'))
        .send({
          type: 'PERSON',
          name: '  Ana Torres  ',
          email: '  ANA@Example.COM ',
          documentType: ' dni ',
          documentNumber: ' 09876543 ',
        })
        .expect(201);

      expect(response.body.name).toBe('Ana Torres');
      expect(response.body.email).toBe('ana@example.com');
      expect(response.body.documentType).toBe('DNI');
      expect(response.body.documentNumber).toBe('09876543');
    });

    it('rejects an empty name, a bad email and an unknown type', async () => {
      const invalid = [
        { type: 'COMPANY', name: '   ' },
        { type: 'COMPANY', name: 'Valid', email: 'not-an-email' },
        { type: 'ALIEN', name: 'Valid' },
      ];

      for (const body of invalid) {
        await request(app.getHttpServer())
          .post('/clients')
          .set(asRole('OWNER'))
          .send(body)
          .expect(400);
      }
    });

    it('refuses a duplicate document number inside the organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/clients')
        .set(asRole('OWNER'))
        .send({ type: 'COMPANY', name: 'Clon SAC', documentNumber: '20123456789' })
        .expect(409);

      expect(response.body.code).toBe('CLIENT_DOCUMENT_ALREADY_EXISTS');
    });

    it('allows the same document number in a different organization', async () => {
      // Two organizations may legitimately deal with the same company.
      await request(app.getHttpServer())
        .post('/clients')
        .set({ Authorization: `Bearer ${outsiderToken}` })
        .send({ type: 'COMPANY', name: 'Acme SAC', documentNumber: '20123456789' })
        .expect(201);
    });

    it('allows several clients with no document number at all', async () => {
      // PostgreSQL treats each NULL as distinct, so the unique constraint does
      // not collapse undocumented clients into one.
      for (const name of ['Sin Documento 1', 'Sin Documento 2']) {
        await request(app.getHttpServer())
          .post('/clients')
          .set(asRole('OWNER'))
          .send({ type: 'PERSON', name })
          .expect(201);
      }
    });
  });

  describe('PATCH /clients/:id', () => {
    it('allows OWNER, ADMIN and MANAGER, and blocks MEMBER', async () => {
      for (const role of ['OWNER', 'ADMIN', 'MANAGER'] as Role[]) {
        await request(app.getHttpServer())
          .patch(`/clients/${ownClientId}`)
          .set(asRole(role))
          .send({ name: `Acme ${role}` })
          .expect(200);
      }

      await request(app.getHttpServer())
        .patch(`/clients/${ownClientId}`)
        .set(asRole('MEMBER'))
        .send({ name: 'Nope' })
        .expect(403);
    });

    it('updates partially', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/clients/${ownClientId}`)
        .set(asRole('OWNER'))
        .send({ status: 'INACTIVE' })
        .expect(200);

      expect(response.body.status).toBe('INACTIVE');
      // Untouched fields survive.
      expect(response.body.name).toBe('Acme SAC');
    });

    it('refuses to move a client to another organization', async () => {
      await request(app.getHttpServer())
        .patch(`/clients/${ownClientId}`)
        .set(asRole('OWNER'))
        .send({ organizationId: otherOrgId })
        .expect(400);

      const row = await prisma.client.findUnique({
        where: { id: ownClientId },
        select: { organizationId: true },
      });

      expect(row?.organizationId).toBe(ownOrgId);
    });

    it('answers 404 for a client of another organization', async () => {
      await request(app.getHttpServer())
        .patch(`/clients/${otherClientId}`)
        .set(asRole('OWNER'))
        .send({ name: 'Hijacked' })
        .expect(404);

      const row = await prisma.client.findUnique({ where: { id: otherClientId } });

      expect(row?.name).toBe('Secret Client');
    });

    it('refuses a document number already used by another client', async () => {
      const other = await prisma.client.create({
        data: { organizationId: ownOrgId, type: 'PERSON', name: 'Otro', documentNumber: '111' },
      });

      const response = await request(app.getHttpServer())
        .patch(`/clients/${other.id}`)
        .set(asRole('OWNER'))
        .send({ documentNumber: '20123456789' })
        .expect(409);

      expect(response.body.code).toBe('CLIENT_DOCUMENT_ALREADY_EXISTS');
    });

    it('lets a client keep its own document number', async () => {
      await request(app.getHttpServer())
        .patch(`/clients/${ownClientId}`)
        .set(asRole('OWNER'))
        .send({ documentNumber: '20123456789', name: 'Acme Renombrada' })
        .expect(200);
    });
  });

  describe('DELETE /clients/:id', () => {
    it('allows OWNER and ADMIN', async () => {
      for (const role of ['OWNER', 'ADMIN'] as Role[]) {
        const created = await prisma.client.create({
          data: { organizationId: ownOrgId, type: 'PERSON', name: `Borrable ${role}` },
        });

        await request(app.getHttpServer())
          .delete(`/clients/${created.id}`)
          .set(asRole(role))
          .expect(204);
      }
    });

    it('blocks MANAGER and MEMBER', async () => {
      for (const role of ['MANAGER', 'MEMBER'] as Role[]) {
        const response = await request(app.getHttpServer())
          .delete(`/clients/${ownClientId}`)
          .set(asRole(role))
          .expect(403);

        expect(response.body.code).toBe('FORBIDDEN');
      }

      // And the client is still there.
      expect(await prisma.client.findUnique({ where: { id: ownClientId } })).not.toBeNull();
    });

    it('answers 404 for a client of another organization', async () => {
      await request(app.getHttpServer())
        .delete(`/clients/${otherClientId}`)
        .set(asRole('OWNER'))
        .expect(404);

      expect(await prisma.client.findUnique({ where: { id: otherClientId } })).not.toBeNull();
    });

    it('refuses to delete a client that has projects', async () => {
      await prisma.project.create({
        data: {
          organizationId: ownOrgId,
          clientId: ownClientId,
          name: 'Proyecto vivo',
          code: 'NEX-001',
        },
      });

      const response = await request(app.getHttpServer())
        .delete(`/clients/${ownClientId}`)
        .set(asRole('OWNER'))
        .expect(409);

      expect(response.body.code).toBe('CLIENT_HAS_PROJECTS');
      // The work is not silently orphaned.
      expect(await prisma.client.findUnique({ where: { id: ownClientId } })).not.toBeNull();
      expect(await prisma.project.count()).toBe(1);
    });
  });
});
