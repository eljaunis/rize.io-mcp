# Rize MCP Server

MCP (Model Context Protocol) server for [Rize.io](https://rize.io) time tracking integration. Works with Windsurf, Claude Desktop, and other MCP-compatible clients.

## Setup

1. Clone this repo
2. Get your Rize API key from **Settings > API** in the Rize app
3. Install and build:
   ```bash
   npm install
   npm run build
   ```

## Available Tools

### Read Operations
| Tool | Description |
|------|-------------|
| `rize_get_current_user` | Get current authenticated user info |
| `rize_list_clients` | List all clients (with team info) |
| `rize_list_projects` | List all projects (with client info) |
| `rize_list_tasks` | List all tasks (with project info) |
| `rize_get_time_entries` | Get time entries for a date range |
| `rize_get_summaries` | Get time summaries (focus, meeting, break time) |
| `rize_get_current_session` | Get the current active session |

### Create Operations
| Tool | Description |
|------|-------------|
| `rize_create_client` | Create a new client |
| `rize_create_project` | Create a new project (optionally linked to client) |
| `rize_create_task` | Create a new task (optionally linked to project) |
| `rize_create_task_time_entry` | Log time to a task |

### Update Operations
| Tool | Description |
|------|-------------|
| `rize_update_client` | Update client (rename, set status) |
| `rize_update_project` | Update project (rename, change client, set status) |
| `rize_update_task` | Update task (rename, change project, set status) |

### Delete Operations
| Tool | Description |
|------|-------------|
| `rize_delete_client` | Delete a client by ID |
| `rize_delete_project` | Delete a project by ID |
| `rize_delete_task` | Delete a task by ID |

**Note:** Create/update operations require a `teamName` parameter to specify which team to operate under.

## MCP Configuration

### Windsurf

Add to your `mcp_config.json`:

```json
{
  "mcpServers": {
    "rize": {
      "command": "node",
      "args": ["/path/to/rize-mcp/dist/index.js"],
      "env": {
        "RIZE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "rize": {
      "command": "node",
      "args": ["/path/to/rize-mcp/dist/index.js"],
      "env": {
        "RIZE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## License

MIT
