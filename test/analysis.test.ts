import { describe, expect, it } from 'vitest';
import { aggregateTimeEntries, buildAnalysisContext } from '../src/analysis.js';
import type { SessionRecord, TimeEntryRecord } from '../src/types.js';

describe('analysis helpers', () => {
  it('aggregates time by client, project, task, and day', () => {
    const entries: TimeEntryRecord[] = [
      {
        durationSeconds: 1800,
        endTime: '2026-04-14T09:30:00Z',
        id: 'entry-1',
        startTime: '2026-04-14T09:00:00Z',
        task: {
          id: 'task-1',
          name: 'Design review',
          project: {
            client: { id: 'client-1', name: 'Acme Corp' },
            id: 'project-1',
            name: 'Website',
          },
        },
      },
      {
        durationSeconds: 3600,
        endTime: '2026-04-14T11:00:00Z',
        id: 'entry-2',
        startTime: '2026-04-14T10:00:00Z',
        task: {
          id: 'task-2',
          name: 'API work',
          project: {
            client: { id: 'client-2', name: 'Internal' },
            id: 'project-2',
            name: 'Platform',
          },
        },
      },
    ];

    const aggregates = aggregateTimeEntries(entries);

    expect(aggregates.totalTrackedSeconds).toBe(5400);
    expect(aggregates.byClient[0]).toEqual({
      durationSeconds: 3600,
      id: 'client-2',
      name: 'Internal',
    });
    expect(aggregates.byDay).toEqual([{ date: '2026-04-14', durationSeconds: 5400 }]);
  });

  it('adds warnings for unavailable prompt data and filtered summaries', () => {
    const entries: TimeEntryRecord[] = [
      {
        durationSeconds: 1800,
        endTime: '2026-04-14T09:30:00Z',
        id: 'entry-1',
        startTime: '2026-04-14T09:00:00Z',
        task: {
          id: 'task-1',
          name: 'Design review',
          project: {
            client: { id: 'client-1', name: 'Acme Corp' },
            id: 'project-1',
            name: 'Website',
          },
        },
      },
    ];
    const sessions: SessionRecord[] = [
      {
        durationSeconds: 1800,
        endTime: '2026-04-14T09:30:00Z',
        id: 'session-1',
        projects: [{ id: 'project-1', name: 'Website' }],
        startTime: '2026-04-14T09:00:00Z',
        tasks: [{ id: 'task-1', name: 'Design review' }],
        title: 'Review',
        type: 'meeting',
      },
    ];

    const context = buildAnalysisContext({
      bucketSize: 'day',
      clientIds: ['client-1'],
      currentSession: null,
      endDate: '2026-04-15',
      limit: 10,
      prompt: 'Analyze margin and future capacity for Acme',
      projectsForClientFilters: [
        {
          client: { id: 'client-1', name: 'Acme Corp' },
          id: 'project-1',
          name: 'Website',
        },
      ],
      projectIds: undefined,
      sessions,
      startDate: '2026-04-14',
      summaries: [
        {
          breakTimeSeconds: 300,
          endTime: '2026-04-15T00:00:00Z',
          focusTimeSeconds: 900,
          meetingTimeSeconds: 1800,
          startTime: '2026-04-14T00:00:00Z',
          trackedTimeSeconds: 1800,
          workHoursSeconds: 2100,
        },
      ],
      taskIds: undefined,
      timeEntries: entries,
    });

    expect(context.warnings).toContain(
      'Rize data in this MCP does not include financial, billing, or budget fields.'
    );
    expect(context.warnings).toContain(
      'The MCP only returns current and historical Rize data. Any forecasting must be inferred by Claude.'
    );
    expect(context.warnings).toContain(
      'Summary buckets are team-wide Rize totals for the date range. Entity filters only apply to the detailed sessions, entries, and derived aggregates.'
    );
  });
});
