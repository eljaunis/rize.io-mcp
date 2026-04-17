import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { AppError } from './errors.js';
import { isAppError, toFailureEnvelope } from './errors.js';
import {
  handleAuthorizeSubmission,
  parseAuthUsers,
  renderAuthorizePage,
} from './auth.js';
import { createApp } from './mcp-app.js';
import type { AppDependencies, CloudflareEnv } from './types.js';
const DEFAULT_AUTHORIZE_ROUTE = '/authorize';
const DEFAULT_TOKEN_ROUTE = '/token';
const DEFAULT_CLIENT_REGISTRATION_ROUTE = '/register';

const authHandler = {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const authorizeRoute = env.OAUTH_AUTHORIZE_ROUTE ?? DEFAULT_AUTHORIZE_ROUTE;
      const healthRoute = env.HEALTH_ROUTE ?? '/health';

      if (url.pathname === healthRoute) {
        return createApp(env).fetch(request, ctx);
      }

      if (url.pathname === authorizeRoute && request.method === 'GET') {
        assertOAuthConfig(env);
        return renderAuthorizePage(request, env);
      }

      if (url.pathname === authorizeRoute && request.method === 'POST') {
        assertOAuthConfig(env);
        return handleAuthorizeSubmission(request, env);
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return toAuthErrorResponse(error, request);
    }
  },
};

export function createOAuthProtectedHandler(
  env: CloudflareEnv,
  deps: AppDependencies = {}
) {
  return new OAuthProvider<CloudflareEnv>({
    accessTokenTTL: 60 * 60,
    allowPlainPKCE: false,
    apiHandler: {
      async fetch(request: Request, _env: CloudflareEnv, ctx: ExecutionContext) {
        return createApp(env, deps).fetch(request, ctx);
      },
    },
    apiRoute: env.MCP_ROUTE ?? '/mcp',
    authorizeEndpoint: env.OAUTH_AUTHORIZE_ROUTE ?? DEFAULT_AUTHORIZE_ROUTE,
    clientRegistrationEndpoint:
      env.OAUTH_CLIENT_REGISTRATION_ROUTE ?? DEFAULT_CLIENT_REGISTRATION_ROUTE,
    defaultHandler: authHandler,
    refreshTokenTTL: 60 * 60 * 24 * 30,
    scopesSupported: ['reports:read'],
    tokenEndpoint: env.TOKEN_ROUTE ?? DEFAULT_TOKEN_ROUTE,
  });
}

function assertOAuthConfig(env: CloudflareEnv): void {
  parseAuthUsers(env);
  if (!env.SESSION_SIGNING_SECRET) {
    throw new AppError('CONFIG_ERROR', 'SESSION_SIGNING_SECRET is required', {
      status: 500,
    });
  }
}

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    try {
      return await createOAuthProtectedHandler(env).fetch(request, env, ctx);
    } catch (error) {
      return toAuthErrorResponse(error, request);
    }
  },
};

function toAuthErrorResponse(error: unknown, request: Request): Response {
  const failure = toFailureEnvelope(error);
  const status = isAppError(error) ? error.status : 500;
  const wantsHtml = request.headers.get('accept')?.includes('text/html');

  console.error(
    JSON.stringify({
      error: failure.error,
      event: 'oauth_request_failed',
      method: request.method,
      path: new URL(request.url).pathname,
    })
  );

  if (wantsHtml) {
    return new Response(
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Authorization Error</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; background: #f7f8fb; color: #111827; margin: 0; }
      main { max-width: 560px; margin: 48px auto; background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px; box-shadow: 0 10px 30px rgba(17,24,39,0.08); }
      h1 { font-size: 24px; margin: 0 0 12px; }
      p, pre { line-height: 1.5; color: #374151; }
      pre { white-space: pre-wrap; background: #f9fafb; border-radius: 12px; padding: 14px; overflow-x: auto; }
    </style>
  </head>
  <body>
    <main>
      <h1>Authorization Error</h1>
      <p>The Rize MCP authorization flow failed before it could complete.</p>
      <pre>${escapeHtml(JSON.stringify(failure, null, 2))}</pre>
    </main>
  </body>
</html>`,
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
        status,
      }
    );
  }

  return Response.json(failure, { status });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
