import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getIssue,
  searchIssues,
  formatIssue,
  formatAssignee,
  formatIssueList
} from "../services/jira-client.js";
import { CHARACTER_LIMIT } from "../constants.js";

export function registerJiraTools(server: McpServer): void {

  // ── 1. Get a single ticket ────────────────────────────────────────
  server.registerTool(
    "jira_get_issue",
    {
      title: "Get Jira Issue",
      description: `Fetch a Jira issue/ticket by its key and return full details including assignee.

Returns: issue summary, type, status, priority, assignee (or "Unassigned"), reporter, dates, and labels.

Args:
  - issue_key (string): Jira issue key, e.g. "PROJ-123"

Examples:
  - "Get ticket PROJ-42" → issue_key: "PROJ-42"
  - "Is MYAPP-100 assigned to someone?" → issue_key: "MYAPP-100"

Errors:
  - "Not authenticated" → run 'npm run auth' first
  - "Jira API error 404" → issue key does not exist`,
      inputSchema: z.object({
        issue_key: z.string()
          .min(1)
          .regex(/^[A-Z][A-Z0-9_]+-\d+$/, "Must be a valid Jira key like PROJ-123")
          .describe("Jira issue key (e.g. PROJ-123)")
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ issue_key }) => {
      const issue = await getIssue(issue_key);
      const text = formatIssue(issue);
      return {
        content: [{ type: "text", text: text.slice(0, CHARACTER_LIMIT) }]
      };
    }
  );

  // ── 2. Check assignee only ────────────────────────────────────────
  server.registerTool(
    "jira_check_assignee",
    {
      title: "Check Jira Issue Assignee",
      description: `Check if a Jira issue is assigned to someone and return assignee info.

Returns a simple assignee status: name and email if assigned, or "Unassigned" if not.
Faster than jira_get_issue when you only need assignment info.

Args:
  - issue_key (string): Jira issue key, e.g. "PROJ-123"

Returns:
  - "✅ Jane Doe <jane@company.com>" if assigned
  - "⚠️  Unassigned" if not assigned

Examples:
  - "Is PROJ-42 assigned?" → issue_key: "PROJ-42"
  - "Who is working on BUG-7?" → issue_key: "BUG-7"`,
      inputSchema: z.object({
        issue_key: z.string()
          .min(1)
          .regex(/^[A-Z][A-Z0-9_]+-\d+$/, "Must be a valid Jira key like PROJ-123")
          .describe("Jira issue key (e.g. PROJ-123)")
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ issue_key }) => {
      const issue = await getIssue(issue_key, ["assignee", "summary"]);
      const assigneeText = formatAssignee(issue);
      const text = `**${issue.key}** — ${issue.fields.summary}\n\n**Assignee:** ${assigneeText}`;
      return {
        content: [{ type: "text", text }]
      };
    }
  );

  // ── 3. Search issues by JQL ───────────────────────────────────────
  server.registerTool(
    "jira_search_issues",
    {
      title: "Search Jira Issues",
      description: `Search Jira issues using JQL (Jira Query Language).

Returns a list of issues matching the query with key, status, assignee, and summary.

Args:
  - jql (string): JQL query string
  - max_results (number): Max issues to return, 1–50 (default: 20)
  - start_at (number): Offset for pagination (default: 0)

Common JQL examples:
  - Unassigned in a project: 'project = PROJ AND assignee is EMPTY'
  - Assigned to me: 'assignee = currentUser()'
  - Open bugs: 'project = PROJ AND issuetype = Bug AND status != Done'
  - Recently updated: 'project = PROJ AND updated >= -7d ORDER BY updated DESC'

Returns:
  Total count + list of issues with key, status, assignee, summary.`,
      inputSchema: z.object({
        jql: z.string()
          .min(1)
          .max(2000)
          .describe("JQL query string, e.g. 'project = PROJ AND assignee is EMPTY'"),
        max_results: z.number().int().min(1).max(50).default(20)
          .describe("Max issues to return (default: 20)"),
        start_at: z.number().int().min(0).default(0)
          .describe("Pagination offset (default: 0)")
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ jql, max_results, start_at }) => {
      const result = await searchIssues(jql, start_at, max_results);
      const text = formatIssueList(result);
      return {
        content: [{ type: "text", text: text.slice(0, CHARACTER_LIMIT) }]
      };
    }
  );

  // ── 4. Find unassigned issues in a project ────────────────────────
  server.registerTool(
    "jira_find_unassigned",
    {
      title: "Find Unassigned Jira Issues",
      description: `Find all unassigned open issues in a Jira project.

A convenience tool that searches for issues where assignee is empty and status is not Done.

Args:
  - project_key (string): Jira project key, e.g. "PROJ"
  - max_results (number): Max issues to return, 1–50 (default: 20)

Returns: List of unassigned issues with key, status, and summary.

Examples:
  - "What's unassigned in PROJ?" → project_key: "PROJ"
  - "Show me open tickets nobody owns" → project_key: "MYAPP"`,
      inputSchema: z.object({
        project_key: z.string()
          .min(1)
          .max(20)
          .regex(/^[A-Z][A-Z0-9_]*$/, "Project key must be uppercase letters/numbers")
          .describe("Jira project key, e.g. PROJ"),
        max_results: z.number().int().min(1).max(50).default(20)
          .describe("Max issues to return (default: 20)")
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ project_key, max_results }) => {
      const jql = `project = ${project_key} AND assignee is EMPTY AND status != Done ORDER BY created DESC`;
      const result = await searchIssues(jql, 0, max_results);
      const text = result.issues.length === 0
        ? `✅ No unassigned open issues found in project **${project_key}**.`
        : formatIssueList(result);
      return {
        content: [{ type: "text", text: text.slice(0, CHARACTER_LIMIT) }]
      };
    }
  );
}
