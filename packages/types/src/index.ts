/**
 * Types shared between the Nexo frontend and backend.
 *
 * Import them as type-only (`import type { ... } from '@nexo/types'`) so the
 * package leaves no trace in the compiled JavaScript.
 *
 * These are public API contracts. They must stay independent of Prisma and of
 * any database model — the frontend never depends on the persistence layer.
 */

/** Health state reported by the API. */
export type ApiStatus = {
  status: 'ok' | 'error';
};

/** Identity and health reported by the API root endpoint. */
export type ApiInfo = ApiStatus & {
  name: string;
};

/** Result of the database health probe. */
export type DatabaseHealth = ApiStatus & {
  database: 'connected' | 'disconnected';
};
