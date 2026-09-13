import { isCalendarDate, projectSchema } from './project-schema';

const VALID = { name: 'Portal de clientes', status: 'PLANNING', priority: 'MEDIUM' } as const;

describe('isCalendarDate', () => {
  it('accepts real dates in YYYY-MM-DD', () => {
    expect(isCalendarDate('2026-10-01')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
  });

  it('rejects impossible dates instead of rolling them over', () => {
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('2027-02-29')).toBe(false);
  });

  it('rejects other formats', () => {
    expect(isCalendarDate('01/10/2026')).toBe(false);
    expect(isCalendarDate('2026-10-01T00:00:00Z')).toBe(false);
  });
});

describe('projectSchema', () => {
  it('accepts the minimum a project needs and has no code field', () => {
    const result = projectSchema.safeParse(VALID);

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('code');
  });

  it('trims the name and rejects a blank or oversized one', () => {
    expect(projectSchema.safeParse({ ...VALID, name: '  Nexo  ' }).data?.name).toBe('Nexo');
    expect(projectSchema.safeParse({ ...VALID, name: '   ' }).success).toBe(false);
    expect(projectSchema.safeParse({ ...VALID, name: 'x'.repeat(201) }).success).toBe(false);
  });

  it('turns blank optional fields into null, which is what the API expects', () => {
    const result = projectSchema.safeParse({
      ...VALID,
      description: '  ',
      clientId: '',
      startDate: '',
      dueDate: '',
    });

    expect(result.data).toMatchObject({
      description: null,
      clientId: null,
      startDate: null,
      dueDate: null,
    });
  });

  it('rejects a client id that is not a UUID', () => {
    expect(projectSchema.safeParse({ ...VALID, clientId: 'acme' }).success).toBe(false);
  });

  it('rejects unknown statuses and priorities', () => {
    expect(projectSchema.safeParse({ ...VALID, status: 'DONE' }).success).toBe(false);
    expect(projectSchema.safeParse({ ...VALID, priority: 'CRITICAL' }).success).toBe(false);
  });

  it('refuses a due date before the start date and points at the due date', () => {
    const result = projectSchema.safeParse({
      ...VALID,
      startDate: '2026-10-10',
      dueDate: '2026-10-01',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['dueDate']);
  });

  it('allows the same start and due date, or just one of them', () => {
    expect(
      projectSchema.safeParse({ ...VALID, startDate: '2026-10-01', dueDate: '2026-10-01' }).success,
    ).toBe(true);
    expect(projectSchema.safeParse({ ...VALID, dueDate: '2026-10-01' }).success).toBe(true);
  });

  it('rejects an impossible date typed by hand', () => {
    expect(projectSchema.safeParse({ ...VALID, startDate: '2026-02-30' }).success).toBe(false);
  });
});
