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
