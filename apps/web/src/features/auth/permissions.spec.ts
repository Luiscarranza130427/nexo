import { ROLE_LABELS, can } from './permissions';

describe('can', () => {
  it('gives an OWNER every capability', () => {
    expect(can('OWNER', 'organization:manage')).toBe(true);
    expect(can('OWNER', 'members:manage')).toBe(true);
    expect(can('OWNER', 'projects:manage')).toBe(true);
    expect(can('OWNER', 'workspace:view')).toBe(true);
  });

  it('lets an ADMIN manage members but not the organization', () => {
    expect(can('ADMIN', 'members:manage')).toBe(true);
    expect(can('ADMIN', 'organization:manage')).toBe(false);
  });

  it('lets a MANAGER manage projects only', () => {
    expect(can('MANAGER', 'projects:manage')).toBe(true);
    expect(can('MANAGER', 'members:manage')).toBe(false);
  });

  it('limits a MEMBER to viewing', () => {
    expect(can('MEMBER', 'workspace:view')).toBe(true);
    expect(can('MEMBER', 'projects:manage')).toBe(false);
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
