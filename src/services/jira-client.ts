import { JIRA_API_BASE } from "../constants.js";
import { getValidTokens } from "./token-store.js";
import type { JiraIssue, JiraSearchResult } from "../types.js";

const CLIENT_ID = process.env.JIRA_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.JIRA_CLIENT_SECRET ?? "";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const tokens = await getValidTokens(CLIENT_ID, CLIENT_SECRET);
  return {
    Authorization: `Bearer ${tokens.access_token}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}

async function getCloudId(): Promise<{ cloudId: string; baseUrl: string }> {
  const tokens = await getValidTokens(CLIENT_ID, CLIENT_SECRET);
  return { cloudId: tokens.cloud_id, baseUrl: tokens.cloud_url };
}

async function jiraFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { cloudId } = await getCloudId();
  const headers = await getAuthHeaders();
  const url = `${JIRA_API_BASE}/${cloudId}/rest/api/3${path}`;

  const response = await fetch(url, { ...options, headers: { ...headers, ...options?.headers } });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jira API error ${response.status} for ${path}: ${body}`);
  }

  return response.json() as Promise<T>;
}

// ── Issue operations ────────────────────────────────────────────────

export async function getIssue(issueKey: string, fields?: string[]): Promise<JiraIssue> {
  const fieldParam = fields ? `?fields=${fields.join(",")}` : "";
  return jiraFetch<JiraIssue>(`/issue/${encodeURIComponent(issueKey)}${fieldParam}`);
}

export async function searchIssues(
  jql: string,
  startAt = 0,
  maxResults = 20,
  fields?: string[]
): Promise<JiraSearchResult> {
  const body = {
    jql,
    startAt,
    maxResults,
    fields: fields ?? [
      "summary", "assignee", "status", "priority",
      "issuetype", "reporter", "created", "updated", "duedate", "labels"
    ]
  };
  return jiraFetch<JiraSearchResult>("/search", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

// ── ADF (Atlassian Document Format) to plain text ──────────────────

function adfToText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;

  if (n.type === "text") return (n.text as string) ?? "";

  const children = Array.isArray(n.content) ? n.content : [];
  const text = children.map(adfToText).join("");

  switch (n.type) {
    case "paragraph":
    case "heading":
      return text + "\n";
    case "bulletList":
    case "orderedList":
      return text;
    case "listItem":
      return `- ${text}`;
    case "hardBreak":
      return "\n";
    default:
      return text;
  }
}

// ── Formatting helpers ──────────────────────────────────────────────

export function formatAssignee(issue: JiraIssue): string {
  const a = issue.fields.assignee;
  if (!a) return "⚠️  Unassigned";
  const email = a.emailAddress ? ` <${a.emailAddress}>` : "";
  return `✅ ${a.displayName}${email}`;
}

export function formatIssue(issue: JiraIssue): string {
  const f = issue.fields;
  const lines: string[] = [
    `🎫 **${issue.key}** — ${f.summary}`,
    ``,
    `**Type:**      ${f.issuetype.name}`,
    `**Status:**    ${f.status.name} (${f.status.statusCategory.name})`,
    `**Priority:**  ${f.priority?.name ?? "None"}`,
    `**Assignee:**  ${formatAssignee(issue)}`,
    `**Reporter:**  ${f.reporter?.displayName ?? "Unknown"}`,
    `**Created:**   ${new Date(f.created).toLocaleString()}`,
    `**Updated:**   ${new Date(f.updated).toLocaleString()}`
  ];

  if (f.duedate) lines.push(`**Due Date:**  ${f.duedate}`);
  if (f.labels?.length) lines.push(`**Labels:**    ${f.labels.join(", ")}`);

  if (f.description) {
    const desc = adfToText(f.description).trim();
    if (desc) {
      lines.push("", "---", "", "**Description:**", "", desc);
    }
  }

  return lines.join("\n");
}

export function formatIssueList(result: JiraSearchResult): string {
  if (result.issues.length === 0) return "No issues found.";

  const rows = result.issues.map(issue => {
    const assignee = issue.fields.assignee?.displayName ?? "Unassigned";
    return `• **${issue.key}** | ${issue.fields.status.name} | ${assignee} — ${issue.fields.summary}`;
  });

  const header = `Found **${result.total}** issue(s) (showing ${result.issues.length}):`;
  return [header, "", ...rows].join("\n");
}
