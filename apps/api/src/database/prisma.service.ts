import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Connection failures often echo the connection string back in the message.
 * Strip it so no credential can ever reach the logs.
 */
function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return message.replace(/postgres(?:ql)?:\/\/\S*/gi, 'postgresql://[redacted]');
}

/**
 * The single Prisma Client instance for the application.
 *
 * Provided and exported by DatabaseModule, which is imported once, so Nest
 * keeps exactly one instance and one connection pool.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: configService.getOrThrow<string>('DATABASE_URL'),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Runs a minimal query to confirm PostgreSQL actually answers. Returns a
   * boolean rather than throwing, so callers never surface driver internals.
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error(`Database health check failed: ${describeError(error)}`);
      return false;
    }
  }
}
