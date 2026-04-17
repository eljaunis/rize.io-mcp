import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodTypeAny } from 'zod';
import {
  buildAnalysisContext,
  filterProjects,
  filterSessions,
  filterTimeEntries,
  limitRecords,
  sortByName,
  sortByStartTimeDescending,
} from './analysis.js';
import { AppError } from './errors.js';
import { answerQuestion } from './question-answer.js';
import { RizeClient } from './rize-client.js';
import { toFailureResult, toSuccessResult } from './response.js';
import {
  analysisInputSchema,
  clientListInputSchema,
  emptyInputSchema,
  projectListInputSchema,
  questionAnswerInputSchema,
  sessionsInputSchema,
  summariesInputSchema,
  taskListInputSchema,
  timeEntriesInputSchema,
} from './schemas.js';
import type { CloudflareEnv } from './types.js';

interface ToolContext {
  client: RizeClient;
  env: CloudflareEnv;
}

interface ToolDefinition {
  description: string;
  execute: (args: any, context: ToolContext) => Promise<unknown>;
  inputSchema: ZodTypeAny;
  name: string;
}

export function createRizeMcpServer(env: CloudflareEnv, client: RizeClient): McpServer {
  const server = new McpServer({
    name: 'rize-team-analytics-mcp',
    version: '1.0.0',
  });

  const context: ToolContext = { client, env };

  for (const tool of getToolDefinitions()) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (args) => {
        try {
          const data = await tool.execute(args, context);
          return toSuccessResult(data);
        } catch (error) {
          return toFailureResult(error);
        }
      }
    );
  }

  return server;
}

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: 'rize_question_answer_get',
      description:
        'Answer a natural-language question about tracked hours, allocation, trends, and time analytics for the selected period.',
      inputSchema: questionAnswerInputSchema,
      execute: async (args, { client }) => answerQuestion(args, client),
    },
    {
      name: 'rize_user_get',
      description: 'Get the currently authenticated Rize user for this shared team workspace.',
      inputSchema: emptyInputSchema,
      execute: async (_args, { client }) => ({
        user: await client.getCurrentUser(),
      }),
    },
    {
      name: 'rize_clients_list',
      description: 'List clients available in the shared Rize team workspace.',
      inputSchema: clientListInputSchema,
      execute: async (args, { client }) => {
        const clients = sortByName(await client.listClients(args.limit ?? 50));
        return {
          count: clients.length,
          items: clients,
        };
      },
    },
    {
      name: 'rize_projects_list',
      description:
        'List projects in the shared Rize workspace, optionally narrowed to specific client IDs.',
      inputSchema: projectListInputSchema,
      execute: async (args, { client }) => {
        const projects = filterProjects(
          await client.listProjects(args.limit ?? 200),
          args.clientIds ? { clientIds: args.clientIds } : {}
        );

        return {
          count: projects.length,
          items: sortByName(limitRecords(projects, args.limit)),
        };
      },
    },
    {
      name: 'rize_tasks_list',
      description:
        'List tasks in the shared Rize workspace, optionally narrowed to specific project IDs.',
      inputSchema: taskListInputSchema,
      execute: async (args, { client }) => {
        const tasks = (await client.listTasks(args.limit ?? 200)).filter((task) => {
          if (!args.projectIds?.length) {
            return true;
          }

          return Boolean(task.project && args.projectIds.includes(task.project.id));
        });

        return {
          count: tasks.length,
          items: sortByName(limitRecords(tasks, args.limit)),
        };
      },
    },
    {
      name: 'rize_time_entries_list',
      description:
        'List approved task time entries for a date range, with optional client, project, and task filters.',
      inputSchema: timeEntriesInputSchema,
      execute: async (args, { client }) => {
        const projects = args.clientIds?.length ? await client.listProjects(500) : [];
        const filtered = filterTimeEntries(
          await client.getTimeEntries(args.startDate, args.endDate),
          args,
          projects
        );
        const items = limitRecords(sortByStartTimeDescending(filtered), args.limit ?? 100);

        return {
          count: filtered.length,
          filters: {
            clientIds: args.clientIds ?? [],
            projectIds: args.projectIds ?? [],
            taskIds: args.taskIds ?? [],
          },
          items,
        };
      },
    },
    {
      name: 'rize_summaries_get',
      description:
        'Get workspace-level Rize summary buckets for a date range, including focus, meeting, break, tracked, and work-hour totals.',
      inputSchema: summariesInputSchema,
      execute: async (args, { client }) => {
        const buckets = await client.getSummaries(args.startDate, args.endDate, args.bucketSize);
        return {
          bucketSize: args.bucketSize,
          count: buckets.length,
          scope: 'team',
          summaries: buckets,
        };
      },
    },
    {
      name: 'rize_sessions_current_get',
      description: 'Get the current active Rize session, if one exists.',
      inputSchema: emptyInputSchema,
      execute: async (_args, { client }) => ({
        currentSession: await client.getCurrentSession(),
      }),
    },
    {
      name: 'rize_sessions_list',
      description:
        'List focus, break, and meeting sessions for a date range, with optional filters on related projects or tasks.',
      inputSchema: sessionsInputSchema,
      execute: async (args, { client }) => {
        const projects = args.clientIds?.length ? await client.listProjects(500) : [];
        const filtered = filterSessions(
          await client.getSessions(args.startDate, args.endDate),
          args,
          projects
        );

        return {
          count: filtered.length,
          filters: {
            clientIds: args.clientIds ?? [],
            projectIds: args.projectIds ?? [],
            taskIds: args.taskIds ?? [],
          },
          items: limitRecords(sortByStartTimeDescending(filtered), args.limit ?? 100),
        };
      },
    },
    {
      name: 'rize_analysis_context_get',
      description:
        'Fetch advanced raw analysis context for Claude when drill-down data is needed beyond the question-answer tool.',
      inputSchema: analysisInputSchema,
      execute: async (args, { client }) => {
        const [currentSession, summaries, timeEntries, sessions, projects] = await Promise.all([
          client.getCurrentSession(),
          client.getSummaries(args.startDate, args.endDate, args.bucketSize),
          client.getTimeEntries(args.startDate, args.endDate),
          client.getSessions(args.startDate, args.endDate),
          args.clientIds?.length ? client.listProjects(500) : Promise.resolve([]),
        ]);

        return buildAnalysisContext({
          bucketSize: args.bucketSize,
          clientIds: args.clientIds,
          currentSession,
          endDate: args.endDate,
          limit: args.limit ?? 50,
          projectIds: args.projectIds,
          projectsForClientFilters: projects,
          prompt: args.prompt,
          sessions,
          startDate: args.startDate,
          summaries,
          taskIds: args.taskIds,
          timeEntries,
        });
      },
    },
  ];
}

export function assertRequiredEnv(env: CloudflareEnv): void {
  if (!env.RIZE_API_KEY) {
    throw new AppError('CONFIG_ERROR', 'RIZE_API_KEY is required', { status: 500 });
  }

  if (!env.MCP_SHARED_API_KEY) {
    throw new AppError('CONFIG_ERROR', 'MCP_SHARED_API_KEY is required', { status: 500 });
  }
}
