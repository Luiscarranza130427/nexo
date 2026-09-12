import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { ApiInfo, ApiStatus, DatabaseHealth } from '@nexo/types';
import { AppService } from './app.service.js';
import { Public } from './auth/decorators/public.decorator.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getInfo(): ApiInfo {
    return this.appService.getInfo();
  }

  @Public()
  @Get('health')
  getHealth(): ApiStatus {
    return this.appService.getHealth();
  }

  @Public()
  @Get('health/db')
  async getDatabaseHealth(): Promise<DatabaseHealth> {
    const health = await this.appService.getDatabaseHealth();

    if (health.status !== 'ok') {
      // 503 with the same shape. No driver message, no connection string.
      throw new ServiceUnavailableException(health);
    }

    return health;
  }
}
