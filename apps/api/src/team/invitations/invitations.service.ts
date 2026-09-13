import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AcceptedInvitation,
  CreatedInvitation,
  InvitableRole,
  Invitation,
  InvitationPreview,
  InvitationStatus,
  MembershipRole,
  Paginated,
} from '@nexo/types';
import { MembershipService } from '../../auth/membership.service.js';
import { PASSWORD_MIN_LENGTH, PasswordService } from '../../auth/password.service.js';
import type { AuthContext } from '../../auth/types/auth.types.js';
import { PrismaService } from '../../database/prisma.service.js';
import { lockOrganization } from '../organization-lock.js';
import {
  effectiveInvitationStatus,
  invitableRolesFor,
  parseInvitationTtlDays,
} from '../team-rules.js';
import type { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import type { CreateInvitationDto } from './dto/create-invitation.dto.js';
import type { QueryInvitationsDto } from './dto/query-invitations.dto.js';
import {
  generateInvitationToken,
  hashInvitationToken,
  isWellFormedToken,
} from './invitation-token.js';

const DAY_MS = 86_400_000;

/** What the administration list may show. Never the token fingerprint. */
const INVITATION_SELECT = {
  id: true,
  email: true,
  role: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  acceptedAt: true,
  revokedAt: true,
  invitedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

type InvitationRow = {
  id: string;
  email: string;
  role: MembershipRole;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  invitedBy: { id: string; firstName: string; lastName: string } | null;
};

const iso = (value: Date | null) => (value ? value.toISOString() : null);

function toInvitation(row: InvitationRow, now: Date): Invitation {
  return {
    id: row.id,
    email: row.email,
    // Invitations are only ever written with ADMIN, MANAGER or MEMBER.
    role: row.role as InvitableRole,
    status: effectiveInvitationStatus(row.status, row.expiresAt, now),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    acceptedAt: iso(row.acceptedAt),
    revokedAt: iso(row.revokedAt),
    invitedBy: row.invitedBy
      ? {
          userId: row.invitedBy.id,
          firstName: row.invitedBy.firstName,
          lastName: row.invitedBy.lastName,
        }
      : null,
  };
}

/** The effective-status filter, which the stored column alone cannot express. */
function statusWhere(status: InvitationStatus | undefined, now: Date) {
  switch (status) {
    case undefined:
      return {};
    case 'PENDING':
      return { status: 'PENDING' as const, expiresAt: { gt: now } };
    case 'EXPIRED':
      return {
        OR: [
          { status: 'EXPIRED' as const },
          { status: 'PENDING' as const, expiresAt: { lte: now } },
        ],
      };
    default:
      return { status };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

const notFound = () =>
  new NotFoundException({ code: 'INVITATION_NOT_FOUND', message: 'Invitation not found.' });

function settledError(status: Exclude<InvitationStatus, 'PENDING'>): ConflictException {
  switch (status) {
    case 'EXPIRED':
      return new ConflictException({
        code: 'INVITATION_EXPIRED',
        message: 'This invitation has expired.',
      });
    case 'REVOKED':
      return new ConflictException({
        code: 'INVITATION_REVOKED',
        message: 'This invitation was revoked.',
      });
    case 'ACCEPTED':
      return new ConflictException({
        code: 'INVITATION_ALREADY_ACCEPTED',
        message: 'This invitation was already accepted.',
      });
  }
}

const accountChanged = () =>
  new ConflictException({
    code: 'INVITATION_ACCOUNT_CHANGED',
    message: 'The account for this email changed meanwhile. Open the invitation again.',
  });

@Injectable()
export class InvitationsService {
  private readonly ttlDays: number;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly memberships: MembershipService,
    config: ConfigService,
  ) {
    // Read once, at startup: a bad value stops the API instead of every invitation.
    this.ttlDays = parseInvitationTtlDays(config.get<string>('INVITATION_TTL_DAYS'));
    this.frontendUrl = (config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000').replace(
      /\/+$/,
      '',
    );
  }

  async list(organizationId: string, query: QueryInvitationsDto): Promise<Paginated<Invitation>> {
    const { page, limit, search, status } = query;
    const now = new Date();
    const where = {
      organizationId,
      ...statusWhere(status, now),
      ...(search ? { email: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.invitation.findMany({
        where,
        select: INVITATION_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invitation.count({ where }),
    ]);

    return {
      data: rows.map((row) => toInvitation(row, now)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Creates an invitation and returns its link — the only time the token is
   * ever sent. The organization lock makes the "already a member" and
   * "already pending" checks race-free without a partial unique index.
   */
  async create(auth: AuthContext, dto: CreateInvitationDto): Promise<CreatedInvitation> {
    const { organizationId } = auth;
    const actor = await this.memberships.resolve(auth.userId, organizationId);

    if (!actor || !invitableRolesFor(actor.membership.role).includes(dto.role)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient permissions.' });
    }

    const token = generateInvitationToken();
    const expiresAt = new Date(Date.now() + this.ttlDays * DAY_MS);

    const invitation = await this.prisma.$transaction(async (tx) => {
      await lockOrganization(tx, organizationId);

      const member = await tx.membership.findFirst({
        where: { organizationId, user: { email: dto.email } },
        select: { id: true },
      });

      if (member) {
        throw new ConflictException({
          code: 'USER_ALREADY_MEMBER',
          message: 'That person already belongs to this organization.',
        });
      }

      const now = new Date();
      const pending = await tx.invitation.findFirst({
        where: { organizationId, email: dto.email, status: 'PENDING', expiresAt: { gt: now } },
        select: { id: true },
      });

      if (pending) {
        throw new ConflictException({
          code: 'INVITATION_ALREADY_PENDING',
          message: 'That address already has a pending invitation.',
        });
      }

      // Settle stale pending rows, so an address never has two live-looking invitations.
      await tx.invitation.updateMany({
        where: { organizationId, email: dto.email, status: 'PENDING', expiresAt: { lte: now } },
        data: { status: 'EXPIRED' },
      });

      return tx.invitation.create({
        data: {
          organizationId,
          email: dto.email,
          role: dto.role,
          tokenHash: hashInvitationToken(token),
          expiresAt,
          invitedByUserId: auth.userId,
        },
        select: { id: true, email: true, role: true, expiresAt: true },
      });
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role as InvitableRole,
      expiresAt: invitation.expiresAt.toISOString(),
      inviteUrl: `${this.frontendUrl}/invite/${token}`,
    };
  }

  /** Revokes a pending invitation. Revoking one already revoked is a no-op. */
  async revoke(organizationId: string, id: string): Promise<Invitation> {
    const now = new Date();

    await this.prisma.invitation.updateMany({
      where: { id, organizationId, status: 'PENDING' },
      data: { status: 'REVOKED', revokedAt: now },
    });

    const row = await this.prisma.invitation.findFirst({
      where: { id, organizationId },
      select: INVITATION_SELECT,
    });

    if (!row) {
      throw notFound();
    }

    if (row.status === 'ACCEPTED') {
      throw settledError('ACCEPTED');
    }

    return toInvitation(row, now);
  }

  private async findByToken(token: string) {
    if (!isWellFormedToken(token)) {
      throw notFound();
    }

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      select: {
        id: true,
        organizationId: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        organization: { select: { id: true, name: true, slug: true, status: true } },
      },
    });

    if (!invitation || invitation.organization.status !== 'ACTIVE') {
      throw notFound();
    }

    return invitation;
  }

  /** Persists EXPIRED once a pending invitation is seen past its expiry. */
  private async settleExpired(id: string): Promise<void> {
    await this.prisma.invitation.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
  }

  /**
   * What the public invitation page may know. Nothing internal: no id, no
   * inviter, no fingerprint. `accountExists` tells the page whether to ask for
   * a sign-in or for a new password; it is only revealed to the holder of a
   * valid link, and only about the address that link was sent to.
   */
  async preview(token: string): Promise<InvitationPreview> {
    const invitation = await this.findByToken(token);
    const status = effectiveInvitationStatus(invitation.status, invitation.expiresAt);

    if (status !== 'PENDING') {
      if (invitation.status === 'PENDING') {
        await this.settleExpired(invitation.id);
      }

      return { valid: false, status, organizationName: invitation.organization.name };
    }

    const account = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });

    return {
      valid: true,
      status,
      organizationName: invitation.organization.name,
      email: invitation.email,
      role: invitation.role as InvitableRole,
      expiresAt: invitation.expiresAt.toISOString(),
      accountExists: account !== null,
    };
  }

  /**
   * Accepts an invitation, exactly once.
   *
   * Holding the link is never enough to join as an existing person: the
   * account's password must match. A new person gets an ACTIVE account with an
   * Argon2id hash. The invitation row is locked for the transaction, so two
   * simultaneous acceptances cannot both succeed.
   */
  async accept(dto: AcceptInvitationDto): Promise<AcceptedInvitation> {
    const invitation = await this.findByToken(dto.token);
    const status = effectiveInvitationStatus(invitation.status, invitation.expiresAt);

    if (status !== 'PENDING') {
      if (invitation.status === 'PENDING') {
        await this.settleExpired(invitation.id);
      }

      throw settledError(status);
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true, status: true, passwordHash: true },
    });

    let account: { firstName: string; lastName: string; passwordHash: string } | null = null;

    if (existing) {
      const proven =
        existing.status === 'ACTIVE' &&
        existing.passwordHash !== null &&
        (await this.passwords.verify(existing.passwordHash, dto.password));

      if (!proven) {
        throw new UnauthorizedException({
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials.',
        });
      }
    } else {
      if (!dto.firstName || !dto.lastName) {
        throw new BadRequestException({
          code: 'INVITATION_PROFILE_REQUIRED',
          message: 'First and last name are required to create an account.',
        });
      }

      if (dto.password.length < PASSWORD_MIN_LENGTH) {
        throw new BadRequestException({
          code: 'INVALID_PASSWORD',
          message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
        });
      }

      // Hashed before the transaction: Argon2 is deliberately slow.
      account = {
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash: await this.passwords.hash(dto.password),
      };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const [locked] = await tx.$queryRaw<{ status: InvitationStatus; expiresAt: Date }[]>`
          SELECT "status", "expiresAt" FROM "Invitation" WHERE "id" = ${invitation.id}::uuid FOR UPDATE
        `;

        if (!locked) {
          throw notFound();
        }

        const lockedStatus = effectiveInvitationStatus(locked.status, locked.expiresAt);

        if (lockedStatus !== 'PENDING') {
          throw settledError(lockedStatus);
        }

        const current = await tx.user.findUnique({
          where: { email: invitation.email },
          select: { id: true },
        });

        // What was proven above must still describe the account now.
        if ((current?.id ?? null) !== (existing?.id ?? null)) {
          throw accountChanged();
        }

        let userId: string;

        if (current) {
          userId = current.id;
        } else if (account) {
          const created = await tx.user.create({
            data: { email: invitation.email, status: 'ACTIVE', ...account },
            select: { id: true },
          });

          userId = created.id;
        } else {
          throw accountChanged();
        }

        const membership = await tx.membership.findUnique({
          where: { organizationId_userId: { organizationId: invitation.organizationId, userId } },
          select: { id: true },
        });

        if (membership) {
          throw new ConflictException({
            code: 'USER_ALREADY_MEMBER',
            message: 'You already belong to this organization.',
          });
        }

        await tx.membership.create({
          data: { organizationId: invitation.organizationId, userId, role: invitation.role },
        });
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedByUserId: userId },
        });
      });
    } catch (error) {
      // Another invitation created an account for this address in the same instant.
      if (isUniqueViolation(error)) {
        throw accountChanged();
      }

      throw error;
    }

    const { id, name, slug } = invitation.organization;

    return {
      organization: { id, name, slug },
      email: invitation.email,
      role: invitation.role as InvitableRole,
    };
  }
}
