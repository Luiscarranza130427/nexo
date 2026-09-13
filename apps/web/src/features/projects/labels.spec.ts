import {
  PRIORITIES,
  PRIORITY_LABELS,
  PROJECT_SORT_OPTIONS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  dueDateInfo,
  formatCalendarDate,
  toDateInputValue,
} from './labels';

describe('status and priority labels', () => {
  it('humanizes every project status', () => {
    expect(PROJECT_STATUS_LABELS).toEqual({
      PLANNING: 'Planificación',
      ACTIVE: 'Activo',
      ON_HOLD: 'En pausa',
      COMPLETED: 'Completado',
      CANCELLED: 'Cancelado',
    });
    expect(PROJECT_STATUSES).toEqual(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']);
  });

  it('humanizes every priority, in ascending order', () => {
    expect(PRIORITY_LABELS).toEqual({
      LOW: 'Baja',
      MEDIUM: 'Media',
      HIGH: 'Alta',
      URGENT: 'Urgente',
    });
    expect(PRIORITIES).toEqual(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
  });

  it('offers only sort fields the API accepts', () => {
    const allowed = ['name', 'code', 'createdAt', 'updatedAt', 'startDate', 'dueDate', 'priority'];

    for (const option of PROJECT_SORT_OPTIONS) {
      const [field, order] = option.value.split(':');

      expect(allowed).toContain(field);
      expect(['asc', 'desc']).toContain(order);
    }
  });
});

describe('calendar dates', () => {
  it('formats in UTC, so a date never shows as the day before west of Greenwich', () => {
    // 1 Oct at UTC midnight is still 30 Sep in Lima; the label must say 1 Oct.
    expect(formatCalendarDate('2026-10-01T00:00:00.000Z')).toMatch(/^01/);
  });

  it('turns an API date into the value a date input expects', () => {
    expect(toDateInputValue('2026-10-01T00:00:00.000Z')).toBe('2026-10-01');
    expect(toDateInputValue(null)).toBe('');
  });
});

describe('dueDateInfo', () => {
  // Noon local time, so the test does not depend on the machine's time zone.
  const now = new Date(2026, 9, 10, 12, 0, 0);

  it('says nothing without a due date', () => {
    expect(dueDateInfo(null, 'ACTIVE', now)).toBeNull();
  });

  it('says nothing for finished or cancelled work', () => {
    expect(dueDateInfo('2026-10-01T00:00:00.000Z', 'COMPLETED', now)).toBeNull();
    expect(dueDateInfo('2026-10-01T00:00:00.000Z', 'CANCELLED', now)).toBeNull();
  });

  it('marks overdue projects', () => {
    expect(dueDateInfo('2026-10-09T00:00:00.000Z', 'ACTIVE', now)).toEqual({
      tone: 'overdue',
      label: 'Venció ayer',
    });
    expect(dueDateInfo('2026-10-05T00:00:00.000Z', 'ACTIVE', now)).toEqual({
      tone: 'overdue',
      label: 'Vencido hace 5 días',
    });
  });

  it('marks today and tomorrow', () => {
    expect(dueDateInfo('2026-10-10T00:00:00.000Z', 'ACTIVE', now)?.label).toBe('Vence hoy');
    expect(dueDateInfo('2026-10-11T00:00:00.000Z', 'PLANNING', now)?.label).toBe('Vence mañana');
  });

  it('distinguishes the coming week from later dates', () => {
    expect(dueDateInfo('2026-10-15T00:00:00.000Z', 'ACTIVE', now)).toEqual({
      tone: 'soon',
      label: 'Vence en 5 días',
    });
    expect(dueDateInfo('2026-11-10T00:00:00.000Z', 'ACTIVE', now)).toEqual({
      tone: 'upcoming',
      label: 'Vence en 31 días',
    });
  });
});
