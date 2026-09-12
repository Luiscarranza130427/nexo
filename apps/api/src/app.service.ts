import { Injectable } from '@nestjs/common';
import type { ApiInfo, ApiStatus, DatabaseHealth } from '@nexo/types';
import { PrismaService } from './database/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getInfo(): ApiInfo {
    return { name: 'Nexo API', status: 'ok' };
  }

  getHealth(): ApiStatus {
    return { status: 'ok' };
  }

  async getDatabaseHealth(): Promise<DatabaseHealth> {
    const connected = await this.prisma.isHealthy();

    return connected
      ? { status: 'ok', database: 'connected' }
      : { status: 'error', database: 'disconnected' };
  }
}
