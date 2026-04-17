import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { AppError } from './errors.js';
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
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    return createOAuthProtectedHandler(env).fetch(request, env, ctx);
  },
};
