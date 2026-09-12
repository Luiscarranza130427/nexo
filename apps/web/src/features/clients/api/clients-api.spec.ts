import { buildClientsQuery } from './clients-api';
import { clientKeys } from '../query-keys';

describe('buildClientsQuery', () => {
  it('returns an empty string when there is nothing to send', () => {
    expect(buildClientsQuery({})).toBe('');
  });

  it('serializes the values it is given', () => {
    const query = buildClientsQuery({ page: 2, limit: 10, status: 'ACTIVE' });

    expect(query.startsWith('?')).toBe(true);
    expect(new URLSearchParams(query).get('page')).toBe('2');
    expect(new URLSearchParams(query).get('status')).toBe('ACTIVE');
  });

  it('drops empty values so the URL stays clean', () => {
    // An empty search must not become `?search=`, which would also split the
    // cache into two keys meaning the same thing.
    const query = buildClientsQuery({ page: 1, search: '', status: undefined });

    expect(new URLSearchParams(query).has('search')).toBe(false);
    expect(new URLSearchParams(query).has('status')).toBe(false);
    expect(new URLSearchParams(query).get('page')).toBe('1');
  });

  it('encodes values that need it', () => {
    const query = buildClientsQuery({ search: 'acme & co' });

    expect(query).not.toContain(' ');
    expect(new URLSearchParams(query).get('search')).toBe('acme & co');
  });
});

describe('clientKeys', () => {
  it('nests keys so lists and details invalidate independently', () => {
    expect(clientKeys.lists()).toEqual(['clients', 'list']);
    expect(clientKeys.detail('abc')).toEqual(['clients', 'detail', 'abc']);
    // Both hang off the same root, so `all` still catches everything.
    expect(clientKeys.lists().slice(0, 1)).toEqual(clientKeys.all);
    expect(clientKeys.details().slice(0, 1)).toEqual(clientKeys.all);
  });

  it('gives a different key to each filter combination', () => {
    const first = clientKeys.list({ page: 1, status: 'ACTIVE' });
    const second = clientKeys.list({ page: 1, status: 'INACTIVE' });

    expect(JSON.stringify(first)).not.toBe(JSON.stringify(second));
  });

  it('uses the convention the breadcrumb relies on', () => {
    // NavBreadcrumb resolves a record name from [resource, 'detail', id].
    expect(clientKeys.detail('id-1')).toEqual(['clients', 'detail', 'id-1']);
  });
});
