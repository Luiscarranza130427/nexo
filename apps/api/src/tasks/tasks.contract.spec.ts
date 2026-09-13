import type { BoardTaskStatus, TaskStatus as SharedStatus } from '@nexo/types';
import { TaskStatus as PrismaStatus } from '../generated/prisma/enums.js';
import { BOARD_STATUSES } from './tasks.service.js';

/**
 * `@nexo/types` declares TaskStatus as a plain union so the frontend never
 * depends on Prisma. That is only safe while both definitions agree.
 */
describe('Task contracts', () => {
  it('TaskStatus lists exactly what the database defines', () => {
    const shared: SharedStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];

    expect(Object.values(PrismaStatus).sort()).toEqual([...shared].sort());
  });

  it('puts every status except CANCELLED on the board, in workflow order', () => {
    const board: BoardTaskStatus[] = [...BOARD_STATUSES];

    expect(board).toEqual(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']);
    expect(board).not.toContain('CANCELLED');
  });
});
