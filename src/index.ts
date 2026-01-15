#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { RizeClient } from './rize-client.js';

const RIZE_API_KEY = process.env.RIZE_API_KEY;

if (!RIZE_API_KEY) {
  console.error('RIZE_API_KEY environment variable is required');
  process.exit(1);
}

const rize = new RizeClient(RIZE_API_KEY);

const server = new Server(
  {
    name: 'rize-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'rize_list_projects',
        description: 'List all projects in Rize',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of projects to return (default: 50)',
            },
          },
        },
      },
      {
        name: 'rize_list_clients',
        description: 'List all clients in Rize',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of clients to return (default: 50)',
            },
          },
        },
      },
      {
        name: 'rize_list_tasks',
        description: 'List all tasks in Rize',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of tasks to return (default: 50)',
            },
          },
        },
      },
      {
        name: 'rize_get_time_entries',
        description: 'Get time entries for a date range',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format',
            },
            endDate: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format',
            },
          },
          required: ['startDate', 'endDate'],
        },
      },
      {
        name: 'rize_create_project',
        description: 'Create a new project in Rize',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the project',
            },
            clientName: {
              type: 'string',
              description: 'Optional client name to associate with the project',
            },
            teamName: {
              type: 'string',
              description: 'Team name (use rize_list_clients to find team names)',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'rize_create_client',
        description: 'Create a new client in Rize',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the client',
            },
            teamName: {
              type: 'string',
              description: 'Team name (use rize_list_clients to find team names)',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'rize_create_task',
        description: 'Create a new task in Rize',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the task',
            },
            projectName: {
              type: 'string',
              description: 'Optional project name to associate with the task',
            },
            teamName: {
              type: 'string',
              description: 'Team name (use rize_list_clients to find team names)',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'rize_get_current_user',
        description: 'Get the current authenticated user info',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'rize_get_summaries',
        description: 'Get time summaries (focus time, meeting time, break time) for a date range',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format',
            },
            endDate: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format',
            },
            bucketSize: {
              type: 'string',
              description: 'Bucket size: day, week, or month (default: day)',
              enum: ['day', 'week', 'month'],
            },
          },
          required: ['startDate', 'endDate'],
        },
      },
      {
        name: 'rize_get_current_session',
        description: 'Get the current active session being tracked',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'rize_get_sessions',
        description: 'Get work sessions for a date range. Shows focus, break, and meeting sessions with associated projects/tasks.',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format',
            },
            endDate: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format',
            },
          },
          required: ['startDate', 'endDate'],
        },
      },
      {
        name: 'rize_create_task_time_entry',
        description: 'Log time to a task. Creates a time entry for the specified task.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'ID of the task to log time to',
            },
            startTime: {
              type: 'string',
              description: 'Start time in ISO8601 format (e.g., 2026-01-15T09:00:00Z)',
            },
            endTime: {
              type: 'string',
              description: 'End time in ISO8601 format (e.g., 2026-01-15T10:30:00Z)',
            },
            description: {
              type: 'string',
              description: 'Optional description of the work done',
            },
            billable: {
              type: 'boolean',
              description: 'Whether this time entry is billable (default: false)',
            },
          },
          required: ['taskId', 'startTime', 'endTime'],
        },
      },
      {
        name: 'rize_update_task',
        description: 'Update an existing task (rename, change project, set status)',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID of the task to update',
            },
            name: {
              type: 'string',
              description: 'New name for the task',
            },
            projectName: {
              type: 'string',
              description: 'Project name to move the task to',
            },
            status: {
              type: 'string',
              description: 'Status of the task (active, archived)',
            },
            teamName: {
              type: 'string',
              description: 'Team name',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'rize_update_project',
        description: 'Update an existing project (rename, change client, set status)',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID of the project to update',
            },
            name: {
              type: 'string',
              description: 'New name for the project',
            },
            clientName: {
              type: 'string',
              description: 'Client name to associate with the project',
            },
            status: {
              type: 'string',
              description: 'Status of the project (active, archived)',
            },
            teamName: {
              type: 'string',
              description: 'Team name',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'rize_update_client',
        description: 'Update an existing client (rename, set status)',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID of the client to update',
            },
            name: {
              type: 'string',
              description: 'New name for the client',
            },
            status: {
              type: 'string',
              description: 'Status of the client (active, archived)',
            },
            teamName: {
              type: 'string',
              description: 'Team name',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'rize_delete_task',
        description: 'Delete a task by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID of the task to delete',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'rize_delete_project',
        description: 'Delete a project by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID of the project to delete',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'rize_delete_client',
        description: 'Delete a client by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID of the client to delete',
            },
          },
          required: ['id'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'rize_list_projects': {
        const limit = (args?.limit as number) || 50;
        const result = await rize.listProjects(limit);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_list_clients': {
        const limit = (args?.limit as number) || 50;
        const result = await rize.listClients(limit);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_list_tasks': {
        const limit = (args?.limit as number) || 50;
        const result = await rize.listTasks(limit);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_get_time_entries': {
        const { startDate, endDate } = args as { startDate: string; endDate: string };
        const result = await rize.getTimeEntries(startDate, endDate);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_create_project': {
        const { name: projectName, clientName, teamName } = args as { name: string; clientName?: string; teamName?: string };
        const result = await rize.createProject(projectName, clientName, teamName);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_create_client': {
        const { name: clientName, teamName } = args as { name: string; teamName?: string };
        const result = await rize.createClient(clientName, teamName);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_create_task': {
        const { name: taskName, projectName, teamName } = args as { name: string; projectName?: string; teamName?: string };
        const result = await rize.createTask(taskName, projectName, teamName);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_get_current_user': {
        const result = await rize.getCurrentUser();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_get_summaries': {
        const { startDate, endDate, bucketSize } = args as { startDate: string; endDate: string; bucketSize?: string };
        const result = await rize.getSummaries(startDate, endDate, bucketSize || 'day');
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_get_current_session': {
        const result = await rize.getCurrentSession();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_get_sessions': {
        const { startDate, endDate } = args as { startDate: string; endDate: string };
        const result = await rize.getSessions(startDate, endDate);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_create_task_time_entry': {
        const { taskId, startTime, endTime, description, billable } = args as { taskId: string; startTime: string; endTime: string; description?: string; billable?: boolean };
        const result = await rize.createTaskTimeEntry(taskId, startTime, endTime, description, billable);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_update_task': {
        const { id, name: taskName, projectName, status, teamName } = args as { id: string; name?: string; projectName?: string; status?: string; teamName?: string };
        const result = await rize.updateTask(id, taskName, projectName, status, teamName);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_update_project': {
        const { id, name: projName, clientName, status, teamName } = args as { id: string; name?: string; clientName?: string; status?: string; teamName?: string };
        const result = await rize.updateProject(id, projName, clientName, status, teamName);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_update_client': {
        const { id, name: clientName, status, teamName } = args as { id: string; name?: string; status?: string; teamName?: string };
        const result = await rize.updateClient(id, clientName, status, teamName);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_delete_task': {
        const { id } = args as { id: string };
        const result = await rize.deleteTask(id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_delete_project': {
        const { id } = args as { id: string };
        const result = await rize.deleteProject(id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'rize_delete_client': {
        const { id } = args as { id: string };
        const result = await rize.deleteClient(id);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Rize MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
