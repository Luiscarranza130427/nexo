import { ROLE_LABELS, can, canChangeTask } from './permissions';

describe('can', () => {
  it('gives an OWNER every capability', () => {
    expect(can('OWNER', 'organization:manage')).toBe(true);
    expect(can('OWNER', 'members:manage')).toBe(true);
    expect(can('OWNER', 'projects:delete')).toBe(true);
    expect(can('OWNER', 'workspace:view')).toBe(true);
  });

  it('lets an ADMIN manage members but not the organization', () => {
    expect(can('ADMIN', 'members:manage')).toBe(true);
    expect(can('ADMIN', 'organization:manage')).toBe(false);
  });

  it('lets a MANAGER manage projects only', () => {
    expect(can('MANAGER', 'projects:update')).toBe(true);
    expect(can('MANAGER', 'members:manage')).toBe(false);
  });

  it('limits a MEMBER to viewing', () => {
    expect(can('MEMBER', 'workspace:view')).toBe(true);
    expect(can('MEMBER', 'projects:create')).toBe(false);
    expect(can('MEMBER', 'members:manage')).toBe(false);
  });

  it('denies everything without a role', () => {
    expect(can(null, 'workspace:view')).toBe(false);
    expect(can(undefined, 'workspace:view')).toBe(false);
  });
});

describe('client capabilities', () => {
  it('lets OWNER and ADMIN do everything with clients', () => {
    for (const role of ['OWNER', 'ADMIN'] as const) {
      expect(can(role, 'clients:create')).toBe(true);
      expect(can(role, 'clients:update')).toBe(true);
      expect(can(role, 'clients:delete')).toBe(true);
    }
  });

  it('lets MANAGER create and edit but never delete', () => {
    expect(can('MANAGER', 'clients:create')).toBe(true);
    expect(can('MANAGER', 'clients:update')).toBe(true);
    expect(can('MANAGER', 'clients:delete')).toBe(false);
  });

  it('limits MEMBER to reading', () => {
    expect(can('MEMBER', 'clients:create')).toBe(false);
    expect(can('MEMBER', 'clients:update')).toBe(false);
    expect(can('MEMBER', 'clients:delete')).toBe(false);
  });
});

describe('project capabilities', () => {
  it('lets OWNER and ADMIN do everything with projects', () => {
    for (const role of ['OWNER', 'ADMIN'] as const) {
      for (const capability of ['create', 'update', 'delete', 'members'] as const) {
        expect(can(role, `projects:${capability}`)).toBe(true);
      }
    }
  });

  it('lets MANAGER create, edit and staff projects but never delete them', () => {
    expect(can('MANAGER', 'projects:create')).toBe(true);
    expect(can('MANAGER', 'projects:update')).toBe(true);
    expect(can('MANAGER', 'projects:members')).toBe(true);
    expect(can('MANAGER', 'projects:delete')).toBe(false);
  });

  it('limits MEMBER to reading', () => {
    for (const capability of ['create', 'update', 'delete', 'members'] as const) {
      expect(can('MEMBER', `projects:${capability}`)).toBe(false);
    }
  });
});

describe('task capabilities', () => {
  it('lets OWNER and ADMIN create, manage and delete tasks', () => {
    for (const role of ['OWNER', 'ADMIN'] as const) {
      for (const capability of ['create', 'manage', 'delete'] as const) {
        expect(can(role, `tasks:${capability}`)).toBe(true);
      }
    }
  });

  it('lets MANAGER create and manage tasks but never delete them', () => {
    expect(can('MANAGER', 'tasks:create')).toBe(true);
    expect(can('MANAGER', 'tasks:manage')).toBe(true);
    expect(can('MANAGER', 'tasks:delete')).toBe(false);
  });

  it('gives MEMBER no task capability of its own', () => {
    for (const capability of ['create', 'manage', 'delete'] as const) {
      expect(can('MEMBER', `tasks:${capability}`)).toBe(false);
    }
  });
});

describe('canChangeTask', () => {
  const mine = { assignee: { userId: 'user-1' } };
  const theirs = { assignee: { userId: 'user-2' } };
  const unassigned = { assignee: null };

  it('lets managers and above change any task', () => {
    for (const role of ['OWNER', 'ADMIN', 'MANAGER'] as const) {
      expect(canChangeTask(role, 'user-1', theirs)).toBe(true);
      expect(canChangeTask(role, 'user-1', unassigned)).toBe(true);
    }
  });

  it('limits a MEMBER to tasks assigned to them', () => {
    expect(canChangeTask('MEMBER', 'user-1', mine)).toBe(true);
    expect(canChangeTask('MEMBER', 'user-1', theirs)).toBe(false);
    expect(canChangeTask('MEMBER', 'user-1', unassigned)).toBe(false);
  });

  it('denies everything without a role or a user', () => {
    expect(canChangeTask(null, 'user-1', mine)).toBe(false);
    expect(canChangeTask('MEMBER', null, mine)).toBe(false);
    expect(canChangeTask('MEMBER', undefined, unassigned)).toBe(false);
  });
});

describe('ROLE_LABELS', () => {
  it('humanizes every role, so the interface never shows OWNER verbatim', () => {
    expect(Object.values(ROLE_LABELS)).toEqual([
      'Propietario',
      'Administrador',
      'Gestor',
      'Miembro',
    ]);
    expect(Object.values(ROLE_LABELS).some((label) => label === label.toUpperCase())).toBe(false);
  });
});
