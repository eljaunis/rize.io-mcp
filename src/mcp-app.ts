import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { AppError, isAppError, toFailureEnvelope } from './errors.js';
import { RizeClient } from './rize-client.js';
import { createRizeMcpServer, assertRequiredEnv } from './tools.js';
import type { AppDependencies, CloudflareEnv } from './types.js';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://claude.ai',
  'https://www.claude.ai',
  'https://claude.com',
  'https://www.claude.com',
];

const DEFAULT_HEALTH_ROUTE = '/health';
const DEFAULT_MCP_ROUTE = '/mcp';

export function createApp(env: CloudflareEnv, deps: AppDependencies = {}) {
  const healthRoute = env.HEALTH_ROUTE ?? DEFAULT_HEALTH_ROUTE;
  const mcpRoute = env.MCP_ROUTE ?? DEFAULT_MCP_ROUTE;
  const fetchFn = deps.fetchFn ?? fetch;

  return {
    async fetch(request: Request, _ctx: ExecutionContext): Promise<Response> {
      const url = new URL(request.url);

      if (url.pathname === healthRoute) {
        return Response.json({
          auth: 'oauth',
          ok: true,
          route: mcpRoute,
          service: 'rize-team-analytics-mcp',
        });
      }

      if (url.pathname !== mcpRoute) {
        return Response.json(
          {
            ok: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: `Unknown route: ${url.pathname}`,
            },
          },
          { status: 404 }
        );
      }

      try {
        assertRequiredEnv(env);
        validateOrigin(request, env);

        console.log(
          JSON.stringify({
            event: 'mcp_request',
            hasOrigin: Boolean(request.headers.get('origin')),
            method: request.method,
            path: url.pathname,
          })
        );

        const client = new RizeClient({
          apiKey: env.RIZE_API_KEY!,
          fetchFn,
        });
        const server = createRizeMcpServer(env, client);
        const transport = new WebStandardStreamableHTTPServerTransport({
          enableJsonResponse: true,
        });
        await server.connect(transport);

        return await transport.handleRequest(request);
      } catch (error) {
        const failure = toFailureEnvelope(error);
        const status = isAppError(error) ? error.status : 500;

        console.error(
          JSON.stringify({
            error: failure.error,
            event: 'mcp_request_failed',
            method: request.method,
            path: url.pathname,
          })
        );

        return Response.json(failure, { status });
      }
    },
  };
}

export function getAllowedOrigins(env: CloudflareEnv): string[] {
  const configured = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured])];
}

export function validateOrigin(request: Request, env: CloudflareEnv): void {
  const origin = request.headers.get('origin');

  if (!origin) {
    return;
  }

  if (!getAllowedOrigins(env).includes(origin)) {
    throw new AppError('AUTH_ERROR', `Origin not allowed: ${origin}`, {
      status: 403,
    });
  }
}
