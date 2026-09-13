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
import type { OrganizationMember, Paginated, ProjectDetail, ProjectListItem } from '@nexo/types';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { MembershipRole } from '../generated/prisma/enums.js';
import { AddProjectMemberDto } from './dto/add-project-member.dto.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { QueryProjectsDto } from './dto/query-projects.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { ProjectsService } from './projects.service.js';

/**
 * Every route is authenticated by the global guard and scoped to
 * `@CurrentOrganization()`, which comes from the validated session, never from
 * the request. Roles are matched exactly, so each route lists every role allowed.
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /** Any member of the organization may browse its projects. */
  @Get()
  list(
    @CurrentOrganization() organizationId: string,
    @Query() query: QueryProjectsDto,
  ): Promise<Paginated<ProjectListItem>> {
    return this.projects.list(organizationId, query);
  }

  @Get(':id')
  findOne(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectDetail> {
    return this.projects.findOne(organizationId, id);
  }

  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MANAGER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectDetail> {
    return this.projects.create(organizationId, dto);
  }

  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MANAGER)
  @Patch(':id')
  update(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDetail> {
    return this.projects.update(organizationId, id, dto);
  }

  /** Irreversible, so it stays with the two administrative roles. */
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.projects.remove(organizationId, id);
  }

  @Get(':id/members')
  listMembers(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizationMember[]> {
    return this.projects.listMembers(organizationId, id);
  }

  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MANAGER)
  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  addMember(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddProjectMemberDto,
  ): Promise<OrganizationMember> {
    return this.projects.addMember(organizationId, id, dto.userId);
  }

  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MANAGER)
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.projects.removeMember(organizationId, id, userId);
  }
}
