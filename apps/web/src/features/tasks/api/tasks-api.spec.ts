import { projectKeys } from '@/features/projects/query-keys';
import { taskKeys } from '../query-keys';
import { buildBoardQuery, buildTasksQuery } from './tasks-api';

const PROJECT = '4f6a2b1e-0c3d-4e5f-8a9b-1c2d3e4f5a6b';
const PERSON = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('buildTasksQuery', () => {
  it('serializes every filter the list supports', () => {
    const query = new URLSearchParams(
      buildTasksQuery({
        page: 3,
        limit: 20,
        search: 'login',
        projectId: PROJECT,
        status: 'IN_REVIEW',
        priority: 'URGENT',
        assigneeId: PERSON,
        dueFrom: '2026-10-01',
        dueTo: '2026-10-31',
        sortBy: 'dueDate',
        sortOrder: 'asc',
      }),
    );

    expect(Object.fromEntries(query)).toEqual({
      page: '3',
      limit: '20',
      search: 'login',
      projectId: PROJECT,
      status: 'IN_REVIEW',
      priority: 'URGENT',
      assigneeId: PERSON,
      dueFrom: '2026-10-01',
      dueTo: '2026-10-31',
      sortBy: 'dueDate',
      sortOrder: 'asc',
    });
  });

  it('never sends an organization', () => {
    expect(buildTasksQuery({ page: 1, projectId: PROJECT })).not.toContain('organization');
  });

  it('drops empty values so equivalent states share one URL and cache key', () => {
    expect(buildTasksQuery({ search: '', status: undefined, assigneeId: undefined })).toBe('');
  });
});

describe('buildBoardQuery', () => {
  it('always carries the project and only the filters a board accepts', () => {
    const query = new URLSearchParams(
      buildBoardQuery({ projectId: PROJECT, search: '', priority: 'HIGH', assigneeId: PERSON }),
    );

    expect(Object.fromEntries(query)).toEqual({
      projectId: PROJECT,
      priority: 'HIGH',
      assigneeId: PERSON,
    });
  });
});

describe('taskKeys', () => {
  it('follows the detail convention the breadcrumb reads', () => {
    expect(taskKeys.detail('id-1')).toEqual(['tasks', 'detail', 'id-1']);
  });

  it('keeps lists and boards as siblings under one root', () => {
    expect(taskKeys.lists()).toEqual(['tasks', 'list']);
    expect(taskKeys.boards()).toEqual(['tasks', 'board']);
    expect(taskKeys.board({ projectId: PROJECT })).toEqual([
      'tasks',
      'board',
      { projectId: PROJECT },
    ]);
  });

  it('never collides with the projects root', () => {
    expect(taskKeys.all[0]).not.toBe(projectKeys.all[0]);
  });
});
