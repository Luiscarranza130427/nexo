import { projectKeys } from '@/features/projects/query-keys';
import { invitationPreviewKey, teamKeys } from '../query-keys';
import { buildInvitationsQuery, buildTeamQuery } from './team-api';

describe('buildTeamQuery', () => {
  it('serializes every filter the team list supports', () => {
    const query = new URLSearchParams(
      buildTeamQuery({
        page: 2,
        limit: 20,
        search: 'marta',
        role: 'MANAGER',
        status: 'INACTIVE',
        sortBy: 'joinedAt',
        sortOrder: 'desc',
      }),
    );

    expect(Object.fromEntries(query)).toEqual({
      page: '2',
      limit: '20',
      search: 'marta',
      role: 'MANAGER',
      status: 'INACTIVE',
      sortBy: 'joinedAt',
      sortOrder: 'desc',
    });
  });

  it('never sends an organization, and drops empty values', () => {
    expect(buildTeamQuery({ page: 1 })).not.toContain('organization');
    expect(buildTeamQuery({ search: '', role: undefined })).toBe('');
  });
});

describe('buildInvitationsQuery', () => {
  it('serializes status, search and paging only', () => {
    const query = new URLSearchParams(
      buildInvitationsQuery({ page: 3, limit: 20, search: 'acme', status: 'EXPIRED' }),
    );

    expect(Object.fromEntries(query)).toEqual({
      page: '3',
      limit: '20',
      search: 'acme',
      status: 'EXPIRED',
    });
  });
});

describe('teamKeys', () => {
  it('follows the detail convention the breadcrumb reads', () => {
    expect(teamKeys.detail('user-1')).toEqual(['team', 'detail', 'user-1']);
  });

  it('keeps members, summary and invitations as siblings under one root', () => {
    expect(teamKeys.lists()).toEqual(['team', 'list']);
    expect(teamKeys.summary()).toEqual(['team', 'summary']);
    expect(teamKeys.invitations({ status: 'PENDING' })).toEqual([
      'team',
      'invitations',
      { status: 'PENDING' },
    ]);
  });

  it('keeps the public preview outside the team and project roots', () => {
    expect(invitationPreviewKey('abc')[0]).not.toBe(teamKeys.all[0]);
    expect(invitationPreviewKey('abc')[0]).not.toBe(projectKeys.all[0]);
  });
});
