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
