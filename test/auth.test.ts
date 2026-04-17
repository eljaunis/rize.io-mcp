import { describe, expect, it } from 'vitest';
import {
  authenticateUser,
  createSessionToken,
  parseAuthUsers,
  readSession,
} from '../src/auth.js';
import { TEST_ENV } from './helpers.js';

describe('oauth auth helpers', () => {
  it('parses configured auth users', () => {
    const users = parseAuthUsers(TEST_ENV);

    expect(users).toEqual([
      {
        displayName: 'Juan',
        password: 'secret-pass',
        username: 'juan',
      },
    ]);
  });

  it('authenticates valid credentials', () => {
    const user = authenticateUser(TEST_ENV, 'juan', 'secret-pass');

    expect(user.username).toBe('juan');
    expect(user.displayName).toBe('Juan');
  });

  it('creates and reads signed sessions', async () => {
    const token = await createSessionToken(
      {
        displayName: 'Juan',
        username: 'juan',
      },
      TEST_ENV
    );

    const request = new Request('https://example.com/authorize', {
      headers: {
        cookie: `__Host-rize-session=${token}`,
      },
    });
    const session = await readSession(request, TEST_ENV);

    expect(session).toEqual({
      displayName: 'Juan',
      username: 'juan',
    });
  });
});
