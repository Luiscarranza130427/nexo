import { Controller, Get } from '@nestjs/common';
import type { OrganizationMember } from '@nexo/types';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator.js';
import { MembershipService } from '../auth/membership.service.js';

/**
 * The organization the caller is acting in.
 *
 * Deliberately minimal: `GET /organization/members` exists so other modules can
 * offer people to pick, which today means assigning project members. Inviting,
 * removing and changing roles belong to the team module, which is not built yet.
 */
@Controller('organization')
export class OrganizationController {
  constructor(private readonly memberships: MembershipService) {}

  @Get('members')
  listMembers(@CurrentOrganization() organizationId: string): Promise<OrganizationMember[]> {
    return this.memberships.listMembers(organizationId);
  }
}
