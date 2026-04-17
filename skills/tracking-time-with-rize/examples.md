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

## Ask Claude A Report Question

```text
Tool: rize:rize_question_answer_get
Args: {
  "question": "How many hours did we spend by client in the first half of April?",
  "startDate": "2026-04-01",
  "endDate": "2026-04-15"
}
```

Example response shape:

```json
{
  "ok": true,
  "data": {
    "interpretedRequest": {
      "metric": "trackedTimeSeconds",
      "grouping": "client",
      "intent": "allocation"
    },
    "metrics": {
      "trackedTimeSeconds": 10800,
      "workHoursSeconds": 12600,
      "focusTimeSeconds": 5400,
      "meetingTimeSeconds": 1800,
      "breakTimeSeconds": 600,
      "sessionCount": 2
    },
    "breakdowns": [],
    "comparisons": null,
    "evidence": {},
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
Tool: rize:rize_question_answer_get
Args: {
  "question": "Summarize how much time the team spent on Acme Corp and whether the work was meeting-heavy",
  "startDate": "2026-04-01",
  "endDate": "2026-04-15",
  "clientIds": ["client-1"]
}
```

## Compare Metrics

```text
Tool: rize:rize_question_answer_get
Args: {
  "question": "How did focus time compare to meeting time this week?",
  "startDate": "2026-04-14",
  "endDate": "2026-04-15"
}
```

## Compare Previous Period

```text
Tool: rize:rize_question_answer_get
Args: {
  "question": "What changed week over week?",
  "startDate": "2026-04-14",
  "endDate": "2026-04-15"
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
