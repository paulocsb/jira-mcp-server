import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { registerJiraTools } from "./tools/jira-tools.js";

// Validate required env vars
const CLIENT_ID = process.env.JIRA_CLIENT_ID;
const CLIENT_SECRET = process.env.JIRA_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  process.stderr.write(
    "❌ Missing JIRA_CLIENT_ID or JIRA_CLIENT_SECRET.\n" +
    "   Export them in your shell before starting the server.\n"
  );
  process.exit(1);
}

// Create MCP server
const server = new McpServer({
  name: "jira-mcp-server",
  version: "1.0.0"
});

// Register all Jira tools
registerJiraTools(server);

// ── Transport: stdio (default for Claude Desktop / MCP clients) ──────

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Jira MCP server running on stdio\n");
}

// ── Transport: HTTP (optional, for remote/multi-client use) ──────────

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "jira-mcp-server" });
  });

  const port = parseInt(process.env.PORT ?? "3000");
  app.listen(port, () => {
    process.stderr.write(`Jira MCP server running on http://localhost:${port}/mcp\n`);
  });
}

// Choose transport
const transport = process.env.TRANSPORT ?? "stdio";
if (transport === "http") {
  runHTTP().catch((err: unknown) => {
    process.stderr.write(`Server error: ${err}\n`);
    process.exit(1);
  });
} else {
  runStdio().catch((err: unknown) => {
    process.stderr.write(`Server error: ${err}\n`);
    process.exit(1);
  });
}
