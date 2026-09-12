import { Controller, Get } from '@nestjs/common';
import type { ApiInfo, ApiStatus } from '@nexo/types';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getInfo(): ApiInfo {
    return this.appService.getInfo();
  }

  @Get('health')
  getHealth(): ApiStatus {
    return this.appService.getHealth();
  }
}
