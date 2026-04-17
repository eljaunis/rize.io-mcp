---
name: tracking-time-with-rize
description: Analyze team time tracking and productivity in Rize through a read-only hosted MCP. Use when the user wants Claude to inspect focus time, meetings, client allocation, project effort, or work-pattern trends.
---

# Rize Team Analytics Skill

This skill teaches an agent how to use the hosted Rize MCP as a read-only analytics source for team workflows.

## When To Use This Skill

- The user asks Claude to analyze Rize time data
- The user wants a team-level summary for a date range
- The user asks about client allocation, project effort, task effort, focus time, or meetings
- The user mentions Rize explicitly and wants insights, not data mutation

## Server Reference

Server name: `rize`

This skill assumes a hosted remote MCP endpoint, not a local stdio server.

## Available Tools

| Tool | Purpose |
|------|---------|
| `rize:rize_user_get` | Verify the authenticated Rize identity |
| `rize:rize_clients_list` | List clients |
| `rize:rize_projects_list` | List projects, optionally narrowed by client |
| `rize:rize_tasks_list` | List tasks, optionally narrowed by project |
| `rize:rize_time_entries_list` | Get approved task time entries for a date range |
| `rize:rize_summaries_get` | Get workspace-level summary buckets |
| `rize:rize_sessions_current_get` | Check the currently active session |
| `rize:rize_sessions_list` | Get focus, meeting, and break sessions for a date range |
| `rize:rize_analysis_context_get` | Fetch structured context for Claude to analyze |

## Preferred Workflow

### Default Path

Use `rize:rize_analysis_context_get` first when the user asks an open-ended question.

Provide:

- `prompt`
- `startDate`
- `endDate`
- optional `clientIds`, `projectIds`, or `taskIds`

Then let Claude do the interpretation in-chat.

### Drill-Down Path

If Claude needs to inspect specific entities before asking the analysis tool:

1. Use `rize:rize_clients_list`
2. Use `rize:rize_projects_list` or `rize:rize_tasks_list`
3. Re-run `rize:rize_analysis_context_get` with IDs

### Manual Inspection Path

Use the lower-level read tools only when the user wants raw data or when Claude needs to validate a hypothesis:

1. `rize:rize_summaries_get` for workspace totals
2. `rize:rize_time_entries_list` for tracked task time
3. `rize:rize_sessions_list` for focus/meeting/break patterns

## Important Behavior Notes

- This MCP is read-only. Do not attempt create, update, delete, or time-entry logging workflows.
- Summary buckets are workspace-level totals from Rize. If filters are applied in `rize_analysis_context_get`, the summaries remain team-wide and the tool will warn about that.
- Approved task time entries are returned from Rize. Pending suggestions are not.
- Durations are returned in seconds.
- Dates use `YYYY-MM-DD`.

## How Claude Should Use The Analysis Tool

When you call `rize:rize_analysis_context_get`, expect:

- `normalizedScope`
- `summaries`
- `timeEntries`
- `sessions`
- `warnings`

Claude should:

1. Use `warnings` to qualify the answer
2. Use aggregates first for the answer structure
3. Use raw items only for supporting evidence
4. Avoid claiming data the tool warns is unavailable

## Examples

See [examples.md](./examples.md) for prompt patterns and sample tool calls.
