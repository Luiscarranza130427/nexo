import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * Owns database access for the whole application.
 *
 * Import it wherever PrismaService is needed; Nest resolves it to the same
 * singleton instance. Repositories are deliberately not introduced yet.
 */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
