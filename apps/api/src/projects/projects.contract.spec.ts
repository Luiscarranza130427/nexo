import type { Priority as SharedPriority, ProjectStatus as SharedStatus } from '@nexo/types';
import {
  Priority as PrismaPriority,
  ProjectStatus as PrismaStatus,
} from '../generated/prisma/enums.js';
import { PROJECT_CODE_PREFIX, formatProjectCode } from './project-code.js';

/**
 * `@nexo/types` declares these as plain unions so the frontend never depends on
 * Prisma. That is only safe while both definitions agree.
 */
describe('Project enum contracts', () => {
  it('ProjectStatus lists exactly what the database defines', () => {
    const shared: SharedStatus[] = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

    expect(Object.values(PrismaStatus).sort()).toEqual([...shared].sort());
  });

  it('Priority lists exactly what the database defines', () => {
    const shared: SharedPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

    expect(Object.values(PrismaPriority).sort()).toEqual([...shared].sort());
  });
});

describe('formatProjectCode', () => {
  it('uses the NEX prefix with three-digit padding', () => {
    expect(PROJECT_CODE_PREFIX).toBe('NEX');
    expect(formatProjectCode(1)).toBe('NEX-001');
    expect(formatProjectCode(42)).toBe('NEX-042');
  });

  it('keeps growing past 999 instead of truncating or wrapping', () => {
    expect(formatProjectCode(999)).toBe('NEX-999');
    expect(formatProjectCode(1000)).toBe('NEX-1000');
  });
});
