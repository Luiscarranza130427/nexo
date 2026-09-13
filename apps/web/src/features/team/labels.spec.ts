import {
  INVITATION_STATUSES,
  INVITATION_STATUS_LABELS,
  MEMBERSHIP_ROLES,
  MEMBER_STATUS_LABELS,
  ROLE_DESCRIPTIONS,
  TEAM_SORT_OPTIONS,
  USER_STATUSES,
  fullName,
} from './labels';

describe('status labels', () => {
  it('humanizes every account status', () => {
    expect(MEMBER_STATUS_LABELS).toEqual({
      ACTIVE: 'Activo',
      INACTIVE: 'Inactivo',
      INVITED: 'Invitado',
    });
    expect(USER_STATUSES).toEqual(['ACTIVE', 'INACTIVE', 'INVITED']);
  });

  it('humanizes every invitation status', () => {
    expect(INVITATION_STATUS_LABELS).toEqual({
      PENDING: 'Pendiente',
      ACCEPTED: 'Aceptada',
      EXPIRED: 'Expirada',
      REVOKED: 'Revocada',
    });
    expect(INVITATION_STATUSES).toEqual(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']);
  });
});

describe('roles', () => {
  it('lists every role from highest authority down, each with a description', () => {
    expect(MEMBERSHIP_ROLES).toEqual(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER']);

    for (const role of MEMBERSHIP_ROLES) {
      expect(ROLE_DESCRIPTIONS[role].length).toBeGreaterThan(10);
    }
  });
});

describe('TEAM_SORT_OPTIONS', () => {
  it('only offers fields and orders the API accepts, once each', () => {
    const values = TEAM_SORT_OPTIONS.map((option) => option.value);

    expect(new Set(values).size).toBe(values.length);

    for (const value of values) {
      const [field, order] = value.split(':');

      expect(['name', 'email', 'role', 'joinedAt']).toContain(field);
      expect(['asc', 'desc']).toContain(order);
    }
  });

  it('starts with the API default, so an unsorted URL matches the control', () => {
    expect(TEAM_SORT_OPTIONS[0].value).toBe('name:asc');
  });
});

describe('fullName', () => {
  it('joins the names', () => {
    expect(fullName({ firstName: 'Lucía', lastName: 'Vega' })).toBe('Lucía Vega');
  });
});
