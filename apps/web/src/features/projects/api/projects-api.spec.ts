import { toQueryString } from '@/lib/api/query-string';
import { organizationMembersKey, projectKeys } from '../query-keys';
import { buildProjectsQuery } from './projects-api';

describe('buildProjectsQuery', () => {
  it('serializes every filter the list supports', () => {
    const query = new URLSearchParams(
      buildProjectsQuery({
        page: 2,
        limit: 10,
        search: 'portal',
        status: 'ACTIVE',
        priority: 'HIGH',
        clientId: '4f6a2b1e-0c3d-4e5f-8a9b-1c2d3e4f5a6b',
        memberId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
        sortBy: 'dueDate',
        sortOrder: 'asc',
      }),
    );

    expect(Object.fromEntries(query)).toEqual({
      page: '2',
      limit: '10',
      search: 'portal',
      status: 'ACTIVE',
      priority: 'HIGH',
      clientId: '4f6a2b1e-0c3d-4e5f-8a9b-1c2d3e4f5a6b',
      memberId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
      sortBy: 'dueDate',
      sortOrder: 'asc',
    });
  });

  it('never sends an organization — the API takes it from the session', () => {
    expect(buildProjectsQuery({ page: 1 })).not.toContain('organization');
  });

  it('drops empty values so equivalent states share one URL and cache key', () => {
    expect(buildProjectsQuery({ search: '', status: undefined })).toBe('');
  });
});

describe('toQueryString', () => {
  it('drops null as well as empty and undefined values', () => {
    expect(toQueryString({ a: null, b: undefined, c: '', d: 0 })).toBe('?d=0');
  });
});

describe('projectKeys', () => {
  it('nests lists and details under one root', () => {
    expect(projectKeys.lists()).toEqual(['projects', 'list']);
    expect(projectKeys.detail('id-1')).toEqual(['projects', 'detail', 'id-1']);
  });

  it('keeps members beside the detail key, not under it', () => {
    // The breadcrumb reads ['projects', 'detail', id] as an exact key.
    expect(projectKeys.members('id-1')).toEqual(['projects', 'members', 'id-1']);
    expect(projectKeys.members('id-1').slice(0, 3)).not.toEqual(projectKeys.detail('id-1'));
  });

  it('keeps organization members outside the projects root', () => {
    expect(organizationMembersKey).toEqual(['organization', 'members']);
  });
});
