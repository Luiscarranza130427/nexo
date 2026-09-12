import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';

/**
 * No repository layer: PrismaService already is the data access layer, and
 * wrapping it in another class that forwards calls would add indirection
 * without adding meaning.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
