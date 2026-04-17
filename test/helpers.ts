import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/index.js';
import type { AppDependencies, CloudflareEnv } from '../src/types.js';

export const TEST_ENV: CloudflareEnv = {
  ALLOWED_ORIGINS: 'https://claude.ai',
  MCP_ROUTE: '/mcp',
  MCP_SHARED_API_KEY: 'test-shared-key',
  RIZE_API_KEY: 'test-rize-key',
};

export function createMockRizeFetch() {
  return async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      query?: string;
      variables?: Record<string, unknown>;
    };
    const query = body.query ?? '';

    if (query.includes('query CurrentUser')) {
      return jsonResponse({
        data: {
          currentUser: {
            email: 'team@example.com',
            name: 'Team Analyst',
          },
        },
      });
    }

    if (query.includes('query ListClients')) {
      return jsonResponse({
        data: {
          clients: {
            nodes: [
              {
                id: 'client-1',
                name: 'Acme Corp',
                team: {
                  id: 'team-1',
                  name: 'Rize Team',
                },
              },
              {
                id: 'client-2',
                name: 'Internal',
                team: {
                  id: 'team-1',
                  name: 'Rize Team',
                },
              },
            ],
          },
        },
      });
    }

    if (query.includes('query ListProjects')) {
      return jsonResponse({
        data: {
          projects: {
            nodes: [
              {
                client: {
                  id: 'client-1',
                  name: 'Acme Corp',
                },
                color: '#ff5500',
                id: 'project-1',
                name: 'Website Redesign',
              },
              {
                client: {
                  id: 'client-2',
                  name: 'Internal',
                },
                color: '#0055ff',
                id: 'project-2',
                name: 'Platform',
              },
            ],
          },
        },
      });
    }

    if (query.includes('query ListTasks')) {
      return jsonResponse({
        data: {
          tasks: {
            nodes: [
              {
                id: 'task-1',
                name: 'Design review',
                project: {
                  client: {
                    id: 'client-1',
                    name: 'Acme Corp',
                  },
                  color: '#ff5500',
                  id: 'project-1',
                  name: 'Website Redesign',
                },
              },
              {
                id: 'task-2',
                name: 'API work',
                project: {
                  client: {
                    id: 'client-2',
                    name: 'Internal',
                  },
                  color: '#0055ff',
                  id: 'project-2',
                  name: 'Platform',
                },
              },
            ],
          },
        },
      });
    }

    if (query.includes('query TaskTimeEntries')) {
      return jsonResponse({
        data: {
          taskTimeEntries: [
            {
              duration: 3600,
              endTime: '2026-04-14T10:00:00Z',
              id: 'entry-1',
              startTime: '2026-04-14T09:00:00Z',
              task: {
                id: 'task-1',
                name: 'Design review',
                project: {
                  client: {
                    id: 'client-1',
                    name: 'Acme Corp',
                  },
                  color: '#ff5500',
                  id: 'project-1',
                  name: 'Website Redesign',
                },
              },
            },
            {
              duration: 7200,
              endTime: '2026-04-15T12:00:00Z',
              id: 'entry-2',
              startTime: '2026-04-15T10:00:00Z',
              task: {
                id: 'task-2',
                name: 'API work',
                project: {
                  client: {
                    id: 'client-2',
                    name: 'Internal',
                  },
                  color: '#0055ff',
                  id: 'project-2',
                  name: 'Platform',
                },
              },
            },
          ],
        },
      });
    }

    if (query.includes('query Summaries')) {
      return jsonResponse({
        data: {
          summaries: [
            {
              breakTime: 600,
              endTime: '2026-04-15T00:00:00Z',
              focusTime: 5400,
              meetingTime: 1800,
              startTime: '2026-04-14T00:00:00Z',
              trackedTime: 10800,
              workHours: 12600,
            },
          ],
        },
      });
    }

    if (query.includes('query CurrentSession')) {
      return jsonResponse({
        data: {
          currentSession: {
            endTime: null,
            id: 'session-current',
            startTime: '2026-04-16T13:00:00Z',
            title: 'Heads-down work',
            type: 'focus',
          },
        },
      });
    }

    if (query.includes('query Sessions')) {
      return jsonResponse({
        data: {
          sessions: [
            {
              description: 'Client review',
              endTime: '2026-04-14T11:00:00Z',
              id: 'session-1',
              projects: [
                {
                  client: {
                    id: 'client-1',
                    name: 'Acme Corp',
                  },
                  color: '#ff5500',
                  id: 'project-1',
                  name: 'Website Redesign',
                },
              ],
              source: 'calendar',
              startTime: '2026-04-14T10:00:00Z',
              tasks: [{ id: 'task-1', name: 'Design review' }],
              title: 'Review call',
              type: 'meeting',
            },
            {
              description: 'Implementation',
              endTime: '2026-04-15T12:00:00Z',
              id: 'session-2',
              projects: [
                {
                  client: {
                    id: 'client-2',
                    name: 'Internal',
                  },
                  color: '#0055ff',
                  id: 'project-2',
                  name: 'Platform',
                },
              ],
              source: 'manual',
              startTime: '2026-04-15T10:00:00Z',
              tasks: [{ id: 'task-2', name: 'API work' }],
              title: 'Build API',
              type: 'focus',
            },
          ],
        },
      });
    }

    return jsonResponse(
      {
        errors: [{ message: `Unhandled query in test fetch: ${query}` }],
      },
      500
    );
  };
}

export async function startTestServer(
  env: CloudflareEnv = TEST_ENV,
  deps: AppDependencies = {}
) {
  const app = createApp(env, deps);
  const server = createServer(async (req, res) => {
    await handleNodeRequest(req, res, app, env);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;

  return {
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
    url: new URL(`http://127.0.0.1:${address.port}${env.MCP_ROUTE ?? '/mcp'}`),
  };
}

export function createExecutionContext(): ExecutionContext {
  return {
    passThroughOnException() {},
    waitUntil(_promise: Promise<unknown>) {},
  } as ExecutionContext;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

async function handleNodeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  app: ReturnType<typeof createApp>,
  env: CloudflareEnv
) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(', '));
      continue;
    }

    if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const url = new URL(req.url ?? env.MCP_ROUTE ?? '/mcp', `http://${req.headers.host}`);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  const request = new Request(url, {
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    headers,
    method: req.method,
  });

  const response = await app.fetch(request, createExecutionContext());
  const responseBody = Buffer.from(await response.arrayBuffer());

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(responseBody);
}
