import { Injectable } from '@nestjs/common';
import type { ApiInfo, ApiStatus } from '@nexo/types';

@Injectable()
export class AppService {
  getInfo(): ApiInfo {
    return { name: 'Nexo API', status: 'ok' };
  }

  getHealth(): ApiStatus {
    return { status: 'ok' };
  }
}
