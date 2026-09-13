import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { CreatedInvitation, Invitation, Paginated } from '@nexo/types';
import { CurrentOrganization } from '../../auth/decorators/current-organization.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth.types.js';
import { MembershipRole } from '../../generated/prisma/enums.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { QueryInvitationsDto } from './dto/query-invitations.dto.js';
import { InvitationsService } from './invitations.service.js';

/**
 * Invitation administration, for OWNER and ADMIN. Which role an ADMIN may
 * invite someone as is checked by the service.
 */
@Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
@Controller('team/invitations')
export class TeamInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  list(
    @CurrentOrganization() organizationId: string,
    @Query() query: QueryInvitationsDto,
  ): Promise<Paginated<Invitation>> {
    return this.invitations.list(organizationId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() auth: AuthContext,
    @Body() dto: CreateInvitationDto,
  ): Promise<CreatedInvitation> {
    return this.invitations.create(auth, dto);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  revoke(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Invitation> {
    return this.invitations.revoke(organizationId, id);
  }
}
