# Jira MCP Server

An MCP (Model Context Protocol) server for Jira that authenticates via **OAuth 2.0 / SSO** — no personal API tokens needed.

---

## Prerequisites

- Node.js 18+
- A Jira Cloud account with SSO
- An OAuth app registered in Atlassian (see below)

---

## Step 1 — Register an OAuth App in Atlassian

> You or your Jira admin needs to do this once.

1. Go to [developer.atlassian.com/console/myapps](https://developer.atlassian.com/console/myapps)
2. Click **Create** → **OAuth 2.0 integration**
3. Name it something like "Jira MCP Agent"
4. Under **Permissions**, enable:
   - `read:jira-work` — Read issue data
   - `read:jira-user` — Read user info
5. Under **Authorization → Callback URLs**, add:
   ```
   http://localhost:3001/callback
   ```
6. Copy your **Client ID** and **Client Secret**

---

## Step 2 — Install & Build

```bash
cd jira-mcp-server
npm install
npm run build
```

---

## Step 3 — Set Environment Variables

```bash
export JIRA_CLIENT_ID="your-client-id-here"
export JIRA_CLIENT_SECRET="your-client-secret-here"
```

Tip: add these to your `~/.zshrc` or `~/.bashrc` so they persist.

---

## Step 4 — Authenticate (One-Time SSO Login)

```bash
npm run auth
```

This will:
1. Open your browser to the Atlassian login page
2. You log in using your company SSO (Okta, Azure AD, Google, etc.)
3. Tokens are saved to `~/.jira-mcp-tokens.json`

You only need to do this **once** (tokens auto-refresh).

---

## Step 5 — Connect to an MCP Client

This server supports two transport modes and works with any MCP-compatible agent.

### Stdio (default) — Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, etc.

Stdio is the standard transport for MCP clients that launch the server as a subprocess.

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac):

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/absolute/path/to/jira-mcp-server/dist/index.js"],
      "env": {
        "JIRA_CLIENT_ID": "your-client-id-here",
        "JIRA_CLIENT_SECRET": "your-client-secret-here"
      }
    }
  }
}
```

**Claude Code** (`~/.claude/settings.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/absolute/path/to/jira-mcp-server/dist/index.js"],
      "env": {
        "JIRA_CLIENT_ID": "your-client-id-here",
        "JIRA_CLIENT_SECRET": "your-client-secret-here"
      }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json` in your project root):

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/absolute/path/to/jira-mcp-server/dist/index.js"],
      "env": {
        "JIRA_CLIENT_ID": "your-client-id-here",
        "JIRA_CLIENT_SECRET": "your-client-secret-here"
      }
    }
  }
}
```

**VS Code / Copilot** (`.vscode/mcp.json` in your project root):

```json
{
  "servers": {
    "jira": {
      "command": "node",
      "args": ["/absolute/path/to/jira-mcp-server/dist/index.js"],
      "env": {
        "JIRA_CLIENT_ID": "your-client-id-here",
        "JIRA_CLIENT_SECRET": "your-client-secret-here"
      }
    }
  }
}
```

**Windsurf** (`.windsurf/mcp.json` in your project root):

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/absolute/path/to/jira-mcp-server/dist/index.js"],
      "env": {
        "JIRA_CLIENT_ID": "your-client-id-here",
        "JIRA_CLIENT_SECRET": "your-client-secret-here"
      }
    }
  }
}
```

### HTTP — any agent or custom client

For agents that connect to a remote MCP server over HTTP:

```bash
TRANSPORT=http npm start
# Server runs at http://localhost:3000/mcp
```

- **MCP endpoint**: `POST http://localhost:3000/mcp`
- **Health check**: `GET http://localhost:3000/health`

Any MCP client that supports HTTP transport can connect by pointing to `http://localhost:3000/mcp`.

---

## Available Tools

| Tool | Description |
|---|---|
| `jira_get_issue` | Fetch full details of a ticket (summary, status, assignee, etc.) |
| `jira_check_assignee` | Quick check: is a ticket assigned? Who to? |
| `jira_search_issues` | Search using JQL query language |
| `jira_find_unassigned` | Find all unassigned open issues in a project |

### Example prompts

- *"Is PROJ-42 assigned to someone?"*
- *"Get full details for ticket MYAPP-100"*
- *"Find all unassigned bugs in the BACKEND project"*
- *"Search for tickets assigned to me that are overdue"*

---

## Docker

### Quick Start

```bash
# 1. Create your .env file from the template
cp .env.example .env
# Edit .env with your JIRA_CLIENT_ID and JIRA_CLIENT_SECRET

# 2. Build the image
docker compose build

# 3. Authenticate (one-time) — copy the printed URL into your browser
docker compose run --rm --service-ports auth

# 4. Start the server (HTTP mode on port 3000)
docker compose up -d

# 5. Verify
curl http://localhost:3000/health
```

### Connect an Agent via Docker

**Stdio mode** — for Claude Desktop, Claude Code, Cursor, or any stdio MCP client:

```json
{
  "mcpServers": {
    "jira": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--env-file", "/absolute/path/to/.env",
        "-v", "jira-tokens:/home/mcp",
        "jira-mcp-server"
      ]
    }
  }
}
```

**HTTP mode** — `docker compose up -d` starts the server on port 3000. Any MCP client that supports HTTP transport can connect to:

- **MCP endpoint**: `POST http://localhost:3000/mcp`
- **Health check**: `GET http://localhost:3000/health`

### Docker Commands Reference

| Command | Description |
|---|---|
| `docker compose build` | Build the image |
| `docker compose run --rm --service-ports auth` | Run the OAuth flow |
| `docker compose up -d` | Start the MCP server (HTTP) |
| `docker compose down` | Stop the server |
| `docker compose logs -f server` | Tail server logs |

---

## Token Storage

Tokens are stored at `~/.jira-mcp-tokens.json` with `600` permissions (owner read-only).
They auto-refresh using the offline_access refresh token — no re-login needed.

To log out / reset:
```bash
rm ~/.jira-mcp-tokens.json
```

---

## Troubleshooting

**"Not authenticated"** → Run `npm run auth` first.

**"Session expired"** → Run `npm run auth` again (refresh token may have expired).

**"Jira API error 404"** → The issue key doesn't exist or you don't have access.

**"No Jira Cloud instances accessible"** → Your OAuth app may not have the right permissions — check with your Jira admin.
