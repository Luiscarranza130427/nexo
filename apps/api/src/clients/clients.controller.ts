import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Client, Paginated } from '@nexo/types';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { MembershipRole } from '../generated/prisma/enums.js';
import { ClientsService } from './clients.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { QueryClientsDto } from './dto/query-clients.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';

/**
 * Every route is authenticated by the global guard, and every operation is
 * scoped to `@CurrentOrganization()` — which comes from the validated session,
 * never from the request. A client of another organization is therefore
 * invisible, not merely forbidden.
 *
 * Roles are matched exactly (no implicit hierarchy), so each route lists every
 * role that may use it.
 */
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  /** Any member of the organization may browse its clients. */
  @Get()
  list(
    @CurrentOrganization() organizationId: string,
    @Query() query: QueryClientsDto,
  ): Promise<Paginated<Client>> {
    return this.clients.list(organizationId, query);
  }

  @Get(':id')
  findOne(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Client> {
    return this.clients.findOne(organizationId, id);
  }

  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MANAGER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateClientDto,
  ): Promise<Client> {
    return this.clients.create(organizationId, dto);
  }

  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MANAGER)
  @Patch(':id')
  update(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ): Promise<Client> {
    return this.clients.update(organizationId, id, dto);
  }

  /** Deletion is destructive and irreversible, so it stays with the two admin roles. */
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.clients.remove(organizationId, id);
  }
}
