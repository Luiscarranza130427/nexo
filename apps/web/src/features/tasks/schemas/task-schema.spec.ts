import { taskSchema } from './task-schema';

const PROJECT = '4f6a2b1e-0c3d-4e5f-8a9b-1c2d3e4f5a6b';
const PERSON = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const VALID = {
  projectId: PROJECT,
  title: 'Diseñar el acceso',
  status: 'TODO',
  priority: 'MEDIUM',
} as const;

describe('taskSchema', () => {
  it('accepts the minimum a task needs, with no position or completedAt', () => {
    const result = taskSchema.safeParse(VALID);

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('position');
    expect(result.data).not.toHaveProperty('completedAt');
  });

  it('requires a project', () => {
    const result = taskSchema.safeParse({ ...VALID, projectId: '' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['projectId'],
      message: 'Elige un proyecto.',
    });
  });

  it('trims the title and rejects a blank or oversized one', () => {
    expect(taskSchema.safeParse({ ...VALID, title: '  Revisar  ' }).data?.title).toBe('Revisar');
    expect(taskSchema.safeParse({ ...VALID, title: '   ' }).success).toBe(false);
    expect(taskSchema.safeParse({ ...VALID, title: 'x'.repeat(201) }).success).toBe(false);
  });

  it('caps the description at 5000 characters', () => {
    expect(taskSchema.safeParse({ ...VALID, description: 'x'.repeat(5000) }).success).toBe(true);
    expect(taskSchema.safeParse({ ...VALID, description: 'x'.repeat(5001) }).success).toBe(false);
  });

  it('turns blank optional fields into null, which is what the API expects', () => {
    const result = taskSchema.safeParse({
      ...VALID,
      description: '  ',
      assigneeId: '',
      startDate: '',
      dueDate: '',
    });

    expect(result.data).toMatchObject({
      description: null,
      assigneeId: null,
      startDate: null,
      dueDate: null,
    });
  });

  it('accepts a UUID assignee and rejects anything else', () => {
    expect(taskSchema.safeParse({ ...VALID, assigneeId: PERSON }).data?.assigneeId).toBe(PERSON);
    expect(taskSchema.safeParse({ ...VALID, assigneeId: 'ana' }).success).toBe(false);
  });

  it('accepts every task status, including CANCELLED, and nothing from projects', () => {
    for (const status of ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']) {
      expect(taskSchema.safeParse({ ...VALID, status }).success).toBe(true);
    }

    expect(taskSchema.safeParse({ ...VALID, status: 'ACTIVE' }).success).toBe(false);
    expect(taskSchema.safeParse({ ...VALID, priority: 'CRITICAL' }).success).toBe(false);
  });

  it('refuses a due date before the start date and points at the due date', () => {
    const result = taskSchema.safeParse({
      ...VALID,
      startDate: '2026-10-10',
      dueDate: '2026-10-01',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['dueDate']);
  });

  it('allows the same start and due date, and rejects an impossible one', () => {
    expect(
      taskSchema.safeParse({ ...VALID, startDate: '2026-10-01', dueDate: '2026-10-01' }).success,
    ).toBe(true);
    expect(taskSchema.safeParse({ ...VALID, dueDate: '2026-02-30' }).success).toBe(false);
  });
});
