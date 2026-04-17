import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/errors.js';
import { RizeClient } from '../src/rize-client.js';

describe('RizeClient', () => {
  it('shapes date ranges into ISO datetime boundaries', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ data: { taskTimeEntries: [] } }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    );
    const client = new RizeClient({ apiKey: 'key', fetchFn });

    await client.getTimeEntries('2026-04-01', '2026-04-03');

    const [, init] = fetchFn.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    const body = JSON.parse(String(init.body)) as { variables: Record<string, string> };

    expect(body.variables.startTime).toBe('2026-04-01T00:00:00Z');
    expect(body.variables.endTime).toBe('2026-04-03T23:59:59Z');
  });

  it('maps GraphQL errors into AppError', async () => {
    const client = new RizeClient({
      apiKey: 'key',
      fetchFn: async () =>
        new Response(JSON.stringify({ errors: [{ message: 'Upstream broke' }] }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
    });

    await expect(client.getCurrentUser()).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
      message: 'Upstream broke',
    } satisfies Partial<AppError>);
  });
});
