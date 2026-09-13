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
  Query,
} from '@nestjs/common';
import type { Paginated, TeamMember, TeamMemberDetail, TeamSummary } from '@nexo/types';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../auth/types/auth.types.js';
import { MembershipRole } from '../generated/prisma/enums.js';
import { ChangeRoleDto } from './dto/change-role.dto.js';
import { QueryTeamDto } from './dto/query-team.dto.js';
import { TeamService } from './team.service.js';

/**
 * Every member may see the team. Changing roles and removing people is for
 * OWNER and ADMIN — and even then only within the actor's authority over the
 * target, which the service checks because a decorator cannot see the target.
 */
@Controller('team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  list(
    @CurrentOrganization() organizationId: string,
    @Query() query: QueryTeamDto,
  ): Promise<Paginated<TeamMember>> {
    return this.team.list(organizationId, query);
  }

  /** Declared before `:userId` so the literal path is matched first. */
  @Get('summary')
  summary(@CurrentOrganization() organizationId: string): Promise<TeamSummary> {
    return this.team.summary(organizationId);
  }

  @Get(':userId')
  detail(
    @CurrentUser() auth: AuthContext,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<TeamMemberDetail> {
    return this.team.detail(auth, userId);
  }

  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @Patch(':userId/role')
  changeRole(
    @CurrentUser() auth: AuthContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ChangeRoleDto,
  ): Promise<TeamMember> {
    return this.team.changeRole(auth, userId, dto);
  }

  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() auth: AuthContext,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.team.remove(auth, userId);
  }
}
