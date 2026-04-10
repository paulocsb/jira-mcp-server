// Jira API types

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
  avatarUrls?: Record<string, string>;
}

export interface JiraStatus {
  name: string;
  statusCategory: {
    name: string;
    colorName: string;
  };
}

export interface JiraPriority {
  name: string;
  iconUrl?: string;
}

export interface JiraIssueType {
  name: string;
  description?: string;
  iconUrl?: string;
}

export interface JiraComment {
  id: string;
  author: JiraUser;
  body: unknown; // Atlassian Document Format
  created: string;
  updated: string;
}

export interface JiraIssueFields {
  summary: string;
  description?: unknown; // Atlassian Document Format
  assignee: JiraUser | null;
  reporter: JiraUser | null;
  status: JiraStatus;
  priority: JiraPriority | null;
  issuetype: JiraIssueType;
  created: string;
  updated: string;
  duedate?: string | null;
  labels?: string[];
  comment?: {
    comments: JiraComment[];
    total: number;
  };
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
  startAt: number;
}

export interface AtlassianResource {
  id: string;
  name: string;
  url: string;
  scopes: string[];
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface StoredTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // unix timestamp ms
  cloud_id: string;
  cloud_url: string;
}
