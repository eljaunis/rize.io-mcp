# Rize Team Analytics Examples

Examples for the hosted, read-only Rize MCP.

## Verify The Connection

```text
Tool: rize:rize_user_get
Args: {}
```

Example response:

```json
{
  "ok": true,
  "data": {
    "user": {
      "email": "team@example.com",
      "name": "Team Analyst"
    }
  }
}
```

## Ask Claude For Team Analysis

```text
Tool: rize:rize_analysis_context_get
Args: {
  "prompt": "Analyze focus trends and client allocation for the first half of April",
  "startDate": "2026-04-01",
  "endDate": "2026-04-15"
}
```

Example response shape:

```json
{
  "ok": true,
  "data": {
    "normalizedScope": {
      "bucketSize": "day",
      "dateRange": {
        "startDate": "2026-04-01",
        "endDate": "2026-04-15"
      },
      "inferredTopics": ["focus", "clients", "trends"]
    },
    "summaries": {
      "count": 1,
      "bucketSize": "day",
      "buckets": []
    },
    "timeEntries": {
      "count": 2,
      "aggregates": {
        "totalTrackedSeconds": 10800,
        "byClient": [],
        "byProject": [],
        "byTask": [],
        "byDay": []
      },
      "items": []
    },
    "sessions": {
      "count": 2,
      "aggregates": {
        "countByType": [],
        "durationByType": [],
        "totalSessionCount": 2
      },
      "items": []
    },
    "warnings": []
  }
}
```

## Narrow Analysis To One Client

```text
Tool: rize:rize_clients_list
Args: { "limit": 20 }
```

Find the client ID, then:

```text
Tool: rize:rize_analysis_context_get
Args: {
  "prompt": "Summarize how much time the team spent on Acme Corp and whether the work was meeting-heavy",
  "startDate": "2026-04-01",
  "endDate": "2026-04-15",
  "clientIds": ["client-1"]
}
```

## Inspect Raw Entries

```text
Tool: rize:rize_time_entries_list
Args: {
  "startDate": "2026-04-14",
  "endDate": "2026-04-15",
  "projectIds": ["project-1"],
  "limit": 50
}
```

Use this when the user wants raw approved time entries or when Claude needs to confirm a specific conclusion.

## Inspect Sessions

```text
Tool: rize:rize_sessions_list
Args: {
  "startDate": "2026-04-14",
  "endDate": "2026-04-15",
  "taskIds": ["task-2"]
}
```

Use this to inspect focus, meeting, and break sessions tied to a project or task.

## Known Warning Cases

If the prompt asks about any of the following, expect warnings in `rize_analysis_context_get`:

- budgets
- invoices
- revenue
- margins
- future forecasts
- issue-tracker or source-control data
