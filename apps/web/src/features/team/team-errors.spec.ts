import { ApiError, errorMessage } from '@/lib/api/errors';
import { TEAM_ERROR_MESSAGES, teamErrorMessage } from './team-errors';

const apiError = (status: number, body: unknown) =>
  new ApiError(status, 'UNKNOWN', 'Algo falló.', body);

describe('teamErrorMessage', () => {
  it('explains every team and invitation error in its own words', () => {
    for (const [code, message] of Object.entries(TEAM_ERROR_MESSAGES)) {
      expect(teamErrorMessage(apiError(409, { code }))).toBe(message);
    }
  });

  it('covers the last-owner protection explicitly', () => {
    expect(teamErrorMessage(apiError(409, { code: 'LAST_OWNER_REQUIRED' }))).toContain(
      'propietario',
    );
  });

  it('falls back to the shared wording for anything else, prototype names included', () => {
    for (const code of ['SESSION_EXPIRED', 'toString']) {
      const error = apiError(400, { code });

      expect(teamErrorMessage(error)).toBe(errorMessage(error));
    }

    expect(teamErrorMessage(new Error('boom'))).toBe(errorMessage(new Error('boom')));
  });
});
