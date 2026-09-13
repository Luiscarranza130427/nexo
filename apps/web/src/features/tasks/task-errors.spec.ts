import { ApiError, errorCodeOf, errorMessage } from '@/lib/api/errors';
import { TASK_ERROR_MESSAGES, taskErrorMessage } from './task-errors';

const apiError = (status: number, body: unknown) =>
  new ApiError(status, 'UNKNOWN', 'Algo falló.', body);

describe('errorCodeOf', () => {
  it('reads the code from an API error body', () => {
    expect(errorCodeOf(apiError(400, { code: 'INVALID_TASK_POSITION' }))).toBe(
      'INVALID_TASK_POSITION',
    );
  });

  it('returns null when there is no string code', () => {
    expect(errorCodeOf(apiError(500, undefined))).toBeNull();
    expect(errorCodeOf(apiError(400, { code: 42 }))).toBeNull();
    expect(errorCodeOf(new Error('boom'))).toBeNull();
  });
});

describe('taskErrorMessage', () => {
  it('explains every task error in its own words', () => {
    for (const [code, message] of Object.entries(TASK_ERROR_MESSAGES)) {
      expect(taskErrorMessage(apiError(400, { code }))).toBe(message);
    }
  });

  it('falls back to the shared wording for anything else, prototype names included', () => {
    for (const code of ['SESSION_EXPIRED', 'toString', 'constructor']) {
      const error = apiError(400, { code });

      expect(taskErrorMessage(error)).toBe(errorMessage(error));
    }
  });
});
