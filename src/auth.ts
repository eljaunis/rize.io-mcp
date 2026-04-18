import type { ClientInfo, OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import { AppError } from './errors.js';
import type { CloudflareEnv } from './types.js';

export interface AuthUser {
  displayName?: string;
  password: string;
  username: string;
}

export interface ParsedSession {
  displayName?: string;
  username: string;
}

const DEFAULT_CLIENT_NAME = 'Rize Team Analytics';
const DEFAULT_SCOPE = 'reports:read';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;
const CSRF_COOKIE_NAME = '__Host-rize-csrf';
const SESSION_COOKIE_NAME = '__Host-rize-session';

export async function renderAuthorizePage(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  const oauth = getOAuthHelpers(env);
  const authRequest = await oauth.parseAuthRequest(request);
  const client = (await oauth.lookupClient(authRequest.clientId)) as ClientInfo | null;
  const csrfToken = crypto.randomUUID();
  const session = await readSession(request, env);
  const grantedScopes = authRequest.scope.length > 0 ? authRequest.scope : [DEFAULT_SCOPE];
  const title = session
    ? `Continue as ${escapeHtml(session.displayName ?? session.username)}`
    : 'Sign in to continue';
  const actionLabel = session ? 'Authorize Claude' : 'Sign in and authorize';
  const clientName = client?.clientName ?? DEFAULT_CLIENT_NAME;

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; background: #f7f8fb; color: #111827; margin: 0; }
      main { max-width: 520px; margin: 48px auto; background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px; box-shadow: 0 10px 30px rgba(17,24,39,0.08); }
      h1 { font-size: 24px; margin: 0 0 12px; }
      p, li { line-height: 1.5; color: #374151; }
      label { display: block; margin: 14px 0 6px; font-weight: 600; }
      input { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 10px; border: 1px solid #d1d5db; }
      button { margin-top: 20px; width: 100%; background: #111827; color: white; border: 0; border-radius: 10px; padding: 12px; font-weight: 600; cursor: pointer; }
      .hint { font-size: 14px; color: #6b7280; }
      .box { background: #f9fafb; border-radius: 12px; padding: 14px; margin-top: 16px; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(clientName)} is requesting read-only access to your Rize team analytics tools.</p>
      <div class="box">
        <p><strong>Requested scopes</strong></p>
        <ul>${grantedScopes.map((scope) => `<li>${escapeHtml(scope)}</li>`).join('')}</ul>
      </div>
      <form method="post" action="${escapeHtml(new URL(request.url).toString())}">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}" />
        ${
          session
            ? `<p class="hint">You are signed in as <strong>${escapeHtml(
                session.displayName ?? session.username
              )}</strong>.</p>`
            : `
        <label for="username">Username</label>
        <input id="username" name="username" type="text" autocomplete="username" required />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <p class="hint">Use a username/password configured in your MCP worker secrets.</p>
        `
        }
        <button type="submit">${escapeHtml(actionLabel)}</button>
      </form>
    </main>
  </body>
</html>`,
    {
      headers: {
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'",
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': createCsrfCookie(csrfToken),
      },
    }
  );
}

export async function handleAuthorizeSubmission(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  const oauth = getOAuthHelpers(env);
  const authRequest = await oauth.parseAuthRequest(request);
  const formData = await request.formData();

  validateCsrfToken(formData.get('csrf_token'), request);

  const existingSession = await readSession(request, env);
  const user =
    existingSession ??
    authenticateUser(
      env,
      String(formData.get('username') ?? ''),
      String(formData.get('password') ?? '')
    );

  const grantedScopes = authRequest.scope.length > 0 ? authRequest.scope : [DEFAULT_SCOPE];
  const { redirectTo } = await oauth.completeAuthorization({
    metadata: {
      connector: 'rize-team-analytics',
      grantedAt: new Date().toISOString(),
    },
    props: {
      authUser: {
        displayName: user.displayName ?? user.username,
        username: user.username,
      },
    },
    request: authRequest,
    scope: grantedScopes,
    userId: user.username,
  });

  const headers = new Headers({ Location: redirectTo });
  headers.append('Set-Cookie', clearCookie(CSRF_COOKIE_NAME));
  if (!existingSession) {
    const sessionToken = await createSessionToken(
      {
        displayName: user.displayName,
        username: user.username,
      },
      env
    );
    headers.append('Set-Cookie', createSessionCookie(sessionToken));
  }

  return new Response(null, { headers, status: 302 });
}

export function authenticateUser(
  env: CloudflareEnv,
  username: string,
  password: string
): AuthUser {
  const users = parseAuthUsers(env);
  const user = users.find((candidate) => candidate.username === username);

  if (!user || user.password !== password) {
    throw new AppError('AUTH_ERROR', 'Invalid username or password', { status: 401 });
  }

  return user;
}

export function parseAuthUsers(env: CloudflareEnv): AuthUser[] {
  if (!env.MCP_AUTH_USERS_JSON) {
    throw new AppError('CONFIG_ERROR', 'MCP_AUTH_USERS_JSON is required', { status: 500 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(env.MCP_AUTH_USERS_JSON);
  } catch (error) {
    throw new AppError('CONFIG_ERROR', 'MCP_AUTH_USERS_JSON must be valid JSON', {
      details: error instanceof Error ? error.message : String(error),
      status: 500,
    });
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new AppError('CONFIG_ERROR', 'MCP_AUTH_USERS_JSON must contain at least one user', {
      status: 500,
    });
  }

  return parsed.map((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.username !== 'string' ||
      typeof item.password !== 'string'
    ) {
      throw new AppError('CONFIG_ERROR', 'Each auth user must include username and password', {
        status: 500,
      });
    }

    return {
      displayName: typeof item.displayName === 'string' ? item.displayName : undefined,
      password: item.password,
      username: item.username,
    };
  });
}

export async function readSession(
  request: Request,
  env: CloudflareEnv
): Promise<ParsedSession | null> {
  const cookie = getCookie(request, SESSION_COOKIE_NAME);
  if (!cookie) {
    return null;
  }

  return verifySessionToken(cookie, env);
}

export async function createSessionToken(
  session: ParsedSession,
  env: CloudflareEnv
): Promise<string> {
  const secret = await getSessionSecretKey(env);
  const payload = `${session.username}|${session.displayName ?? ''}|${Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS}`;
  const signature = await signValue(payload, secret);
  return `${toBase64Url(payload)}.${signature}`;
}

async function verifySessionToken(
  token: string,
  env: CloudflareEnv
): Promise<ParsedSession | null> {
  const [encodedPayload, signature] = token.split('.', 2);
  if (!encodedPayload || !signature) {
    return null;
  }

  const secret = await getSessionSecretKey(env);
  const payload = fromBase64Url(encodedPayload);
  const expected = await signValue(payload, secret);
  if (expected !== signature) {
    return null;
  }

  const [username, displayName, expiresAtRaw] = payload.split('|');
  const expiresAt = Number(expiresAtRaw);
  if (!username || Number.isNaN(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    displayName: displayName || undefined,
    username,
  };
}

function getOAuthHelpers(env: CloudflareEnv): OAuthHelpers {
  if (!env.OAUTH_PROVIDER) {
    throw new AppError('CONFIG_ERROR', 'OAuth provider helpers are unavailable', { status: 500 });
  }

  return env.OAUTH_PROVIDER as unknown as OAuthHelpers;
}

function validateCsrfToken(formToken: FormDataEntryValue | null, request: Request) {
  const csrfCookie = getCookie(request, CSRF_COOKIE_NAME);
  if (!formToken || typeof formToken !== 'string' || !csrfCookie || formToken !== csrfCookie) {
    throw new AppError('AUTH_ERROR', 'Invalid authorization form state', { status: 400 });
  }
}

function createCsrfCookie(token: string): string {
  return [
    `${CSRF_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Secure',
    'Max-Age=600',
  ].join('; ');
}

function createSessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ].join('; ');
}

function clearCookie(name: string): string {
  return `${name}=; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=0`;
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) {
      return rest.join('=');
    }
  }

  return null;
}

async function getSessionSecretKey(env: CloudflareEnv): Promise<CryptoKey> {
  if (!env.SESSION_SIGNING_SECRET) {
    throw new AppError('CONFIG_ERROR', 'SESSION_SIGNING_SECRET is required', {
      status: 500,
    });
  }

  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.SESSION_SIGNING_SECRET),
    {
      hash: 'SHA-256',
      name: 'HMAC',
    },
    false,
    ['sign']
  );
}

async function signValue(value: string, key: CryptoKey): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return toBase64UrlBytes(new Uint8Array(signature));
}

function toBase64Url(value: string): string {
  return toBase64UrlBytes(new TextEncoder().encode(value));
}

function toBase64UrlBytes(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
