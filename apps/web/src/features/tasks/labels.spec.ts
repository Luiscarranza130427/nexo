import {
  BOARD_STATUSES,
  TASK_SORT_OPTIONS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  assigneeName,
  taskDueDateInfo,
} from './labels';

describe('task status labels', () => {
  it('humanizes every task status', () => {
    expect(TASK_STATUS_LABELS).toEqual({
      TODO: 'Por hacer',
      IN_PROGRESS: 'En progreso',
      IN_REVIEW: 'En revisión',
      DONE: 'Completada',
      CANCELLED: 'Cancelada',
    });
    expect(TASK_STATUSES).toEqual(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']);
  });

  it('puts every status except CANCELLED on the board, in workflow order', () => {
    expect(BOARD_STATUSES).toEqual(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']);
  });
});

describe('TASK_SORT_OPTIONS', () => {
  it('only offers fields and orders the API accepts, once each', () => {
    const fields = [
      'position',
      'title',
      'priority',
      'createdAt',
      'updatedAt',
      'startDate',
      'dueDate',
    ];
    const values = TASK_SORT_OPTIONS.map((option) => option.value);

    expect(new Set(values).size).toBe(values.length);

    for (const value of values) {
      const [field, order] = value.split(':');

      expect(fields).toContain(field);
      expect(['asc', 'desc']).toContain(order);
    }
  });

  it('starts with the API default, so an unsorted URL matches the control', () => {
    expect(TASK_SORT_OPTIONS[0].value).toBe('createdAt:desc');
  });
});

describe('taskDueDateInfo', () => {
  // 1 October 2026, mid-afternoon in the viewer's own zone.
  const now = new Date(2026, 9, 1, 15, 30);

  it('describes an open task relative to today', () => {
    expect(taskDueDateInfo('2026-09-29T00:00:00.000Z', 'IN_PROGRESS', now)).toEqual({
      tone: 'overdue',
      label: 'Vencido hace 2 días',
    });
    expect(taskDueDateInfo('2026-10-01T00:00:00.000Z', 'TODO', now)).toEqual({
      tone: 'today',
      label: 'Vence hoy',
    });
    expect(taskDueDateInfo('2026-10-02T00:00:00.000Z', 'IN_REVIEW', now)).toEqual({
      tone: 'soon',
      label: 'Vence mañana',
    });
  });

  it('says nothing for a done or cancelled task, or one without a date', () => {
    expect(taskDueDateInfo('2026-09-01T00:00:00.000Z', 'DONE', now)).toBeNull();
    expect(taskDueDateInfo('2026-09-01T00:00:00.000Z', 'CANCELLED', now)).toBeNull();
    expect(taskDueDateInfo(null, 'TODO', now)).toBeNull();
  });
});

describe('assigneeName', () => {
  it('names the assignee, or says there is none', () => {
    expect(assigneeName({ firstName: 'Ana', lastName: 'Ruiz' })).toBe('Ana Ruiz');
    expect(assigneeName(null)).toBe('Sin asignar');
  });
});
