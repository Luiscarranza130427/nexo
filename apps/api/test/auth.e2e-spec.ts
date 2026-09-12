import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { PrismaService } from '../src/database/prisma.service.js';

/**
 * Last line of defence. `vitest.config.e2e.ts` already points DATABASE_URL at
 * the test database, but this suite truncates tables, so refuse to run anywhere
 * that is not obviously the test database.
 */
const databaseUrl = process.env.DATABASE_URL ?? '';

if (!databaseUrl.includes('nexo_test')) {
  throw new Error(
    'Refusing to run end-to-end tests: DATABASE_URL does not point at nexo_test. ' +
      'These tests delete data.',
  );
}

const PASSWORD = 'an-e2e-test-passphrase';
const EMAIL = 'e2e-owner@novatec.test';
const MEMBER_EMAIL = 'e2e-member@novatec.test';
const REFRESH_COOKIE = 'nexo_refresh';

/** Pulls the refresh cookie out of a response, or undefined when absent. */
function refreshCookie(headers: Record<string, unknown>): string | undefined {
  const raw = headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];

  return cookies.find((cookie) => cookie.startsWith(`${REFRESH_COOKIE}=`));
}

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let primaryOrgId: string;
  let secondaryOrgId: string;

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

  beforeEach(async () => {
    // Order matters: children before parents.
    await prisma.session.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();

    const passwordHash = await new PasswordService().hash(PASSWORD);

    const primary = await prisma.organization.create({
      data: { name: 'NovaTec Test', slug: 'novatec-test' },
    });
    const secondary = await prisma.organization.create({
      data: { name: 'Second Org', slug: 'second-org' },
    });

    primaryOrgId = primary.id;
    secondaryOrgId = secondary.id;

    const owner = await prisma.user.create({
      data: { email: EMAIL, firstName: 'Test', lastName: 'Owner', passwordHash },
    });
    const member = await prisma.user.create({
      data: { email: MEMBER_EMAIL, firstName: 'Test', lastName: 'Member', passwordHash },
    });

    await prisma.membership.create({
      data: { organizationId: primary.id, userId: owner.id, role: 'OWNER' },
    });
    await prisma.membership.create({
      data: { organizationId: secondary.id, userId: owner.id, role: 'ADMIN' },
    });
    await prisma.membership.create({
      data: { organizationId: primary.id, userId: member.id, role: 'MEMBER' },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  /** Signs in and returns the access token plus the refresh cookie. */
  async function login(organizationId?: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD, ...(organizationId ? { organizationId } : {}) })
      .expect(200);

    return {
      accessToken: response.body.accessToken as string,
      cookie: refreshCookie(response.headers) ?? '',
    };
  }

  describe('POST /auth/login', () => {
    it('rejects a wrong password and an unknown email identically', async () => {
      const wrongPassword = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: EMAIL, password: 'definitely-not-the-password' })
        .expect(401);

      const unknownEmail = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@novatec.test', password: 'definitely-not-the-password' })
        .expect(401);

      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('asks which organization when the user belongs to several', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: EMAIL, password: PASSWORD })
        .expect(409);

      expect(response.body.code).toBe('ORGANIZATION_REQUIRED');
      expect(response.body.organizations).toHaveLength(2);
      // Only what a chooser needs.
      expect(Object.keys(response.body.organizations[0]).sort()).toEqual(['id', 'name', 'slug']);
    });

    it('signs in when the organization is given', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: EMAIL, password: PASSWORD, organizationId: primaryOrgId })
        .expect(200);

      expect(response.body.user.email).toBe(EMAIL);
      expect(response.body.organization.id).toBe(primaryOrgId);
      expect(response.body.membership.role).toBe('OWNER');
      expect(response.body.accessToken).toBeTypeOf('string');
    });

    it('signs in without an organization when the user belongs to only one', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: MEMBER_EMAIL, password: PASSWORD })
        .expect(200);

      expect(response.body.membership.role).toBe('MEMBER');
    });

    it('sets an HttpOnly refresh cookie scoped to /auth', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: EMAIL, password: PASSWORD, organizationId: primaryOrgId })
        .expect(200);

      const cookie = refreshCookie(response.headers);

      expect(cookie).toBeDefined();
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/auth');
      expect(cookie).toContain('SameSite=Lax');
      // The refresh token must never travel in the JSON body.
      expect(JSON.stringify(response.body)).not.toContain('nexo_refresh');
    });

    it('never returns the password hash', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: EMAIL, password: PASSWORD, organizationId: primaryOrgId })
        .expect(200);

      const body = JSON.stringify(response.body);

      expect(body).not.toContain('passwordHash');
      expect(body).not.toContain('argon2');
    });

    it('rejects an undeclared field instead of silently ignoring it', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: EMAIL, password: PASSWORD, organizationId: primaryOrgId, role: 'OWNER' })
        .expect(400);
    });

    it('rejects a refresh token used as an access token', async () => {
      const { cookie } = await login(primaryOrgId);
      const refreshToken = cookie.split(';')[0].split('=')[1];

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('returns the caller, organization and role', async () => {
      const { accessToken } = await login(primaryOrgId);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        user: {
          id: expect.any(String),
          email: EMAIL,
          firstName: 'Test',
          lastName: 'Owner',
          avatarUrl: null,
        },
        organization: { id: primaryOrgId, name: 'NovaTec Test', slug: 'novatec-test' },
        membership: { role: 'OWNER' },
      });
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token', async () => {
      const { cookie } = await login(primaryOrgId);

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .expect(200);

      const rotated = refreshCookie(response.headers);

      expect(rotated).toBeDefined();
      expect(rotated).not.toBe(cookie);
      expect(rotated).toContain('HttpOnly');
      expect(response.body.accessToken).toBeTypeOf('string');
    });

    it('requires the cookie', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('revokes the session when an already-rotated token is replayed', async () => {
      const { cookie } = await login(primaryOrgId);

      await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(200);

      // Replaying the original cookie is the signature of a stolen token.
      const replay = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);

      expect(replay.body.code).toBe('SESSION_REVOKED');

      const sessions = await prisma.session.findMany();

      expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
    });

    it('stops working once the session is revoked', async () => {
      const { cookie } = await login(primaryOrgId);

      await prisma.session.updateMany({ data: { revokedAt: new Date() } });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);

      expect(response.body.code).toBe('SESSION_REVOKED');
    });

    it('reports an expired session distinctly', async () => {
      const { cookie } = await login(primaryOrgId);

      await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1_000) } });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);

      expect(response.body.code).toBe('SESSION_EXPIRED');
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the session and clears the cookie', async () => {
      const { accessToken, cookie } = await login(primaryOrgId);

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookie)
        .expect(204);

      expect(refreshCookie(response.headers)).toContain('Expires=Thu, 01 Jan 1970');

      // The access token has not expired, yet it is already useless.
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });

  describe('POST /auth/logout-all', () => {
    it('revokes every session of the user', async () => {
      const first = await login(primaryOrgId);
      const second = await login(primaryOrgId);

      const response = await request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${second.accessToken}`)
        .expect(200);

      expect(response.body.revoked).toBe(2);

      for (const session of [first, second]) {
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${session.accessToken}`)
          .expect(401);
      }
    });
  });

  describe('POST /auth/switch-organization', () => {
    it('moves the session to another organization of the user', async () => {
      const { accessToken } = await login(primaryOrgId);

      const response = await request(app.getHttpServer())
        .post('/auth/switch-organization')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ organizationId: secondaryOrgId })
        .expect(200);

      expect(response.body.organization.id).toBe(secondaryOrgId);
      // The role comes from the membership in the new organization.
      expect(response.body.membership.role).toBe('ADMIN');
      expect(refreshCookie(response.headers)).toBeDefined();

      const sessions = await prisma.session.findMany();

      expect(sessions[0].organizationId).toBe(secondaryOrgId);
    });

    it('invalidates access tokens issued for the previous organization', async () => {
      const { accessToken } = await login(primaryOrgId);

      const response = await request(app.getHttpServer())
        .post('/auth/switch-organization')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ organizationId: secondaryOrgId })
        .expect(200);

      // The old token still has a valid signature but names a stale organization.
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200);
    });

    it('refuses an organization the user does not belong to', async () => {
      const memberLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: MEMBER_EMAIL, password: PASSWORD })
        .expect(200);

      const response = await request(app.getHttpServer())
        .post('/auth/switch-organization')
        .set('Authorization', `Bearer ${memberLogin.body.accessToken}`)
        .send({ organizationId: secondaryOrgId })
        .expect(403);

      expect(response.body.code).toBe('INVALID_ORGANIZATION');
    });
  });
});
