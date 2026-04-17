import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockRizeFetch, startTestServer, TEST_ENV } from './helpers.js';

const openServers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (openServers.length > 0) {
    const close = openServers.pop();
    if (close) {
      await close();
    }
  }
});

describe('remote MCP integration', () => {
  it('lists only the read-only tools through the MCP client', async () => {
    const { close, url } = await startTestServer(TEST_ENV, {
      fetchFn: createMockRizeFetch(),
    });
    openServers.push(close);

    const transport = new StreamableHTTPClientTransport(url);
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    await client.connect(transport);
    const toolList = await client.listTools();

    expect(toolList.tools.map((tool) => tool.name)).toEqual([
      'rize_question_answer_get',
      'rize_user_get',
      'rize_clients_list',
      'rize_projects_list',
      'rize_tasks_list',
      'rize_time_entries_list',
      'rize_summaries_get',
      'rize_sessions_current_get',
      'rize_sessions_list',
      'rize_analysis_context_get',
    ]);

    await client.close();
  });

  it('returns structured answer data for report questions', async () => {
    const { close, url } = await startTestServer(TEST_ENV, {
      fetchFn: createMockRizeFetch(),
    });
    openServers.push(close);

    const transport = new StreamableHTTPClientTransport(url);
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    await client.connect(transport);
    const result = await client.callTool({
      arguments: {
        endDate: '2026-04-15',
        question: 'How many hours did we spend by client last week?',
        startDate: '2026-04-14',
      },
      name: 'rize_question_answer_get',
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      data: {
        breakdowns: [
          {
            dimension: 'client',
          },
        ],
        interpretedRequest: {
          defaultedHoursToTrackedTime: true,
          grouping: 'client',
          metric: 'trackedTimeSeconds',
        },
        metrics: {
          trackedTimeSeconds: 10800,
        },
      },
      ok: true,
    });

    await client.close();
  });

  it('returns structured analysis context for Claude-style prompts', async () => {
    const { close, url } = await startTestServer(TEST_ENV, {
      fetchFn: createMockRizeFetch(),
    });
    openServers.push(close);

    const transport = new StreamableHTTPClientTransport(url);
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    await client.connect(transport);
    const result = await client.callTool({
      arguments: {
        endDate: '2026-04-15',
        prompt: 'Analyze team focus trends and compare client work',
        startDate: '2026-04-14',
      },
      name: 'rize_analysis_context_get',
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      data: {
        normalizedScope: {
          inferredTopics: expect.arrayContaining(['focus', 'clients', 'trends']),
        },
        sessions: {
          count: 2,
        },
        timeEntries: {
          aggregates: {
            totalTrackedSeconds: 10800,
          },
          count: 2,
        },
      },
      ok: true,
    });

    await client.close();
  });
});
