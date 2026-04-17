# Rize Team Analytics MCP

Read-only MCP server for [Rize.io](https://rize.io), built for team analytics and Claude-led analysis prompts. It runs as a hosted remote MCP on Cloudflare Workers and exposes a Streamable HTTP endpoint at `/mcp`.

## What Changed

- Remote hosted MCP instead of a local stdio server
- Read-only tools only
- One question-first tool for Claude: `rize_question_answer_get`
- OAuth 2.1 protection for Claude custom connectors
- Zod-backed tool schemas, standardized tool envelopes, and automated tests

## Tool Surface

| Tool | Purpose |
|------|---------|
| `rize_question_answer_get` | Answer a natural-language question about hours, allocation, trends, and time analytics |
| `rize_user_get` | Get the authenticated Rize user |
| `rize_clients_list` | List clients |
| `rize_projects_list` | List projects, optionally filtered by client IDs |
| `rize_tasks_list` | List tasks, optionally filtered by project IDs |
| `rize_time_entries_list` | List approved task time entries for a date range |
| `rize_summaries_get` | Get workspace-level focus/meeting/break/tracked/work-hour summaries |
| `rize_sessions_current_get` | Get the current active session |
| `rize_sessions_list` | List sessions for a date range |
| `rize_analysis_context_get` | Return advanced raw context for drill-down analysis |

All tool responses use the same envelope:

```json
{
  "ok": true,
  "data": {}
}
```

Failures return:

```json
{
  "ok": false,
  "error": {
    "code": "AUTH_ERROR",
    "message": "Unauthorized request"
  }
}
```

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the OAuth KV namespace:

   ```bash
   npx wrangler kv namespace create OAUTH_KV
   ```

   Copy the returned namespace ID into [wrangler.jsonc](C:/Users/JuanManuelRodriguezP/development/rize.io-mcp/wrangler.jsonc) for both `id` and `preview_id`.

3. Add secrets in Cloudflare for deployment:

   ```bash
   npx wrangler secret put RIZE_API_KEY
   npx wrangler secret put SESSION_SIGNING_SECRET
   npx wrangler secret put MCP_AUTH_USERS_JSON
   ```

   `MCP_AUTH_USERS_JSON` should be a JSON array such as:

   ```json
   [{"username":"juan","password":"super-long-password","displayName":"Juan"}]
   ```

4. Optional local vars can come from `.dev.vars`:

   ```env
   ALLOWED_ORIGINS=https://claude.ai,https://www.claude.ai
   MCP_ROUTE=/mcp
   HEALTH_ROUTE=/health
   OAUTH_AUTHORIZE_ROUTE=/authorize
   TOKEN_ROUTE=/token
   OAUTH_CLIENT_REGISTRATION_ROUTE=/register
   ```

5. Verify the project:

   ```bash
   npm run check
   ```

## Run And Deploy

Local dev server:

```bash
npm run dev
```

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

After deploy, the MCP endpoint will be:

```text
https://<worker>.<account>.workers.dev/mcp
```

Health endpoint:

```text
https://<worker>.<account>.workers.dev/health
```

## Authentication

This version now uses OAuth 2.1 for Claude custom connectors.

The Worker acts as an OAuth provider for Claude and uses a small internal login + consent flow for your team. You configure the allowed usernames/passwords via `MCP_AUTH_USERS_JSON`, and the Worker stores OAuth grants in `OAUTH_KV`.

Claude’s official callback URLs to allowlist in your connector auth setup are:

- `https://claude.ai/api/mcp/auth_callback`
- `https://claude.com/api/mcp/auth_callback`

Claude’s current remote MCP guidance documents these callback URLs and the custom connector flow here:

- [Getting started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
- [Build custom connectors via remote MCP servers](https://support.claude.com/en/articles/11503834-build-custom-connectors-via-remote-mcp-servers)

The Worker still validates the `Origin` header when it is present.

## Connect It To Claude

After deployment:

1. Open Claude
2. Go to `Customize > Connectors`
3. Click `+`
4. Choose `Add custom connector`
5. Name it something like `Rize Team Analytics`
6. Use your deployed MCP URL:

   ```text
   https://<worker>.<account>.workers.dev/mcp
   ```

7. Save it and click `Connect`
8. Claude will open your Worker’s `/authorize` flow, where you log in with one of the users from `MCP_AUTH_USERS_JSON`

No static API key is needed in Claude anymore.

## Question-First Workflow

Use `rize_question_answer_get` when Claude should answer a natural-language question such as:

- "Analyze how the team split time between clients last week."
- "Compare focus time and meeting load for April 14 through April 15."
- "Which projects consumed the most tracked time this sprint?"
- "How many hours did we spend by client last week?"
- "What changed week over week?"

Recommended input:

```json
{
  "question": "How many hours did we spend by client last week?",
  "startDate": "2026-04-01",
  "endDate": "2026-04-15",
  "clientIds": ["client-1"],
  "topN": 5
}
```

The tool returns:

- interpreted request details
- headline metrics for tracked time, work hours, focus time, meeting time, break time, and session count
- stable breakdowns for client/project/task/day/week questions
- comparison payloads for metric-vs-metric or previous-period questions
- compact evidence rows for Claude to cite
- warnings when the question asks for unsupported data

Claude is expected to do the narrative reasoning in-chat. The MCP returns structured answer-ready data, not prose.

Use `rize_analysis_context_get` only when Claude needs broader raw context than the question-answer tool provides.

## Testing

```bash
npm run build
npm test
npm run check
```

The test suite covers:

- schema validation
- Rize query shaping and error mapping
- analysis aggregation
- OAuth auth helper behavior
- remote MCP tool listing and tool execution through the SDK client

## Skill

This repo includes a compatible skill at `skills/tracking-time-with-rize/` for agents that should use the hosted MCP as an analytics source rather than a CRUD integration.

## License

MIT
