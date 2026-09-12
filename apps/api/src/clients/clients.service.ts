import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Client, Paginated } from '@nexo/types';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateClientDto } from './dto/create-client.dto.js';
import type { QueryClientsDto } from './dto/query-clients.dto.js';
import type { UpdateClientDto } from './dto/update-client.dto.js';

/**
 * Exactly the fields the API exposes.
 *
 * `organizationId` is never selected: the tenant is implied by the session, and
 * echoing it back would only invite the frontend to start sending it.
 */
const CLIENT_SELECT = {
  id: true,
  type: true,
  name: true,
  documentType: true,
  documentNumber: true,
  email: true,
  phone: true,
  address: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** A row as selected above, before serialization. */
type ClientRow = Omit<Client, 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
};

/** Dates become ISO strings, so the service returns the shared contract exactly. */
function toClient(row: ClientRow): Client {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Prisma signals a unique-constraint violation with P2002. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
  );
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  private static notFound(): NotFoundException {
    // The same answer whether the client does not exist or belongs to another
    // organization. A 403 would confirm the id is real, which is a tenant leak.
    return new NotFoundException({ code: 'CLIENT_NOT_FOUND', message: 'Client not found.' });
  }

  private static documentTaken(): ConflictException {
    return new ConflictException({
      code: 'CLIENT_DOCUMENT_ALREADY_EXISTS',
      message: 'Another client in this organization already uses that document number.',
    });
  }

  async list(organizationId: string, query: QueryClientsDto): Promise<Paginated<Client>> {
    const { page, limit, search, status, type, sortBy, sortOrder } = query;

    const where = {
      // Always first, and never taken from the request: this is the tenant boundary.
      organizationId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(search
        ? {
            // Case-insensitive contains, which PostgreSQL handles natively
            // through Prisma — no raw SQL needed.
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
              { documentNumber: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    // One round trip for the page and one for the count, in parallel. Projects
    // are deliberately not included: a list never needs them.
    const [rows, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        select: CLIENT_SELECT,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: rows.map(toClient),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(organizationId: string, id: string): Promise<Client> {
    const row = await this.prisma.client.findFirst({
      // Scoped by organization, so an id from another tenant simply finds nothing.
      where: { id, organizationId },
      select: CLIENT_SELECT,
    });

    if (!row) {
      throw ClientsService.notFound();
    }

    return toClient(row);
  }

  /**
   * Rejects a document number already used inside this organization.
   *
   * The database enforces this too; checking first turns a raw P2002 into a
   * meaningful error, and the catch around the write covers the race between
   * the two.
   */
  private async assertDocumentAvailable(
    organizationId: string,
    documentNumber: string | null | undefined,
    excludeId?: string,
  ): Promise<void> {
    if (!documentNumber) {
      return;
    }

    const existing = await this.prisma.client.findFirst({
      where: {
        organizationId,
        documentNumber,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw ClientsService.documentTaken();
    }
  }

  async create(organizationId: string, dto: CreateClientDto): Promise<Client> {
    await this.assertDocumentAvailable(organizationId, dto.documentNumber);

    try {
      const row = await this.prisma.client.create({
        // organizationId comes from the session, never from the body.
        data: { ...dto, organizationId },
        select: CLIENT_SELECT,
      });

      return toClient(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ClientsService.documentTaken();
      }

      throw error;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateClientDto): Promise<Client> {
    // Confirms the client is ours before touching anything.
    await this.findOne(organizationId, id);
    await this.assertDocumentAvailable(organizationId, dto.documentNumber, id);

    try {
      const row = await this.prisma.client.update({
        where: { id },
        data: dto,
        select: CLIENT_SELECT,
      });

      return toClient(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw ClientsService.documentTaken();
      }

      throw error;
    }
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.findOne(organizationId, id);

    const projects = await this.prisma.project.count({ where: { clientId: id } });

    if (projects > 0) {
      // The relation is SetNull, so deleting would silently orphan delivered
      // work. Refusing is the honest answer; `status: INACTIVE` is how a client
      // is retired without losing history.
      throw new ConflictException({
        code: 'CLIENT_HAS_PROJECTS',
        message: 'This client has projects and cannot be deleted.',
      });
    }

    await this.prisma.client.delete({ where: { id } });
  }
}
