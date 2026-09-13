import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

/**
 * No repository layer: PrismaService already is the data access layer.
 * AuthModule is imported for MembershipService, which owns the rule for who
 * counts as a member of an organization.
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
