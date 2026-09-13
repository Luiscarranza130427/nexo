import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrganizationController } from './organization.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationController],
})
export class OrganizationModule {}
