import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { InvitationsController } from './invitations/invitations.controller.js';
import { InvitationsService } from './invitations/invitations.service.js';
import { TeamInvitationsController } from './invitations/team-invitations.controller.js';
import { TeamController } from './team.controller.js';
import { TeamService } from './team.service.js';

/**
 * Members, roles and invitations. One module: they share the organization
 * lock, the role rules and MembershipService, and splitting them would only
 * add wiring.
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  // Routes register in this order. `team/invitations` must come before
  // `team/:userId`, or GET /team/invitations would be read as a user id.
  controllers: [TeamInvitationsController, TeamController, InvitationsController],
  providers: [TeamService, InvitationsService],
})
export class TeamModule {}
