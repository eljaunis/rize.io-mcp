import { describe, expect, it } from 'vitest';
import { answerQuestion, interpretQuestion } from '../src/question-answer.js';
import { RizeClient } from '../src/rize-client.js';
import { createMockRizeFetch } from './helpers.js';

describe('question-answer helpers', () => {
  it('defaults ambiguous hours questions to tracked time and client grouping', () => {
    const interpreted = interpretQuestion({
      endDate: '2026-04-15',
      question: 'How many hours did we spend by client last week?',
      startDate: '2026-04-14',
    });

    expect(interpreted.metric).toBe('trackedTimeSeconds');
    expect(interpreted.grouping).toBe('client');
    expect(interpreted.defaultedHoursToTrackedTime).toBe(true);
    expect(interpreted.intent).toBe('allocation');
  });

  it('detects top project questions', () => {
    const interpreted = interpretQuestion({
      endDate: '2026-04-15',
      question: 'Which projects took the most tracked time this month?',
      startDate: '2026-04-01',
    });

    expect(interpreted.grouping).toBe('project');
    expect(interpreted.intent).toBe('top');
    expect(interpreted.metric).toBe('trackedTimeSeconds');
  });

  it('detects metric-vs-metric comparisons', () => {
    const interpreted = interpretQuestion({
      endDate: '2026-04-15',
      question: 'How did focus time compare to meeting time this week?',
      startDate: '2026-04-14',
    });

    expect(interpreted.comparisonMode).toBe('metric_vs_metric');
    expect(interpreted.metric).toBe('focusTimeSeconds');
    expect(interpreted.secondaryMetric).toBe('meetingTimeSeconds');
  });

  it('builds a grouped client-hours answer', async () => {
    const client = new RizeClient({
      apiKey: 'test-key',
      fetchFn: createMockRizeFetch(),
    });

    const result = await answerQuestion(
      {
        endDate: '2026-04-15',
        question: 'How many hours did we spend by client last week?',
        startDate: '2026-04-14',
      },
      client
    );

    expect(result.metrics.trackedTimeSeconds).toBe(10800);
    expect(result.breakdowns[0]).toMatchObject({
      dimension: 'client',
      items: [
        {
          label: 'Internal',
          value: 7200,
        },
        {
          label: 'Acme Corp',
          value: 3600,
        },
      ],
    });
  });

  it('builds previous-period comparisons for change questions', async () => {
    const client = new RizeClient({
      apiKey: 'test-key',
      fetchFn: createMockRizeFetch(),
    });

    const result = await answerQuestion(
      {
        endDate: '2026-04-15',
        question: 'What changed week over week?',
        startDate: '2026-04-14',
      },
      client
    );

    expect(result.comparisons?.kind).toBe('previous_period');
    expect(result.comparisons?.currentPeriod?.trackedTimeSeconds).toBe(10800);
    expect(result.comparisons?.previousPeriod?.trackedTimeSeconds).toBe(10800);
  });

  it('warns for unsupported capacity questions', async () => {
    const client = new RizeClient({
      apiKey: 'test-key',
      fetchFn: createMockRizeFetch(),
    });

    const result = await answerQuestion(
      {
        endDate: '2026-04-15',
        question: 'What is our capacity and utilization for next week?',
        startDate: '2026-04-14',
      },
      client
    );

    expect(result.warnings).toContain(
      'Rize data can describe historical time usage, but capacity and utilization are not explicit source fields here.'
    );
  });
});
