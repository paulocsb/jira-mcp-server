export const ATLASSIAN_AUTH_URL = "https://auth.atlassian.com/authorize";
export const ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
export const ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";
export const JIRA_API_BASE = "https://api.atlassian.com/ex/jira";

export const OAUTH_SCOPES = [
  "read:jira-work",
  "read:jira-user",
  "offline_access"
].join(" ");

export const CALLBACK_PORT = 3001;
export const CALLBACK_PATH = "/callback";
export const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;

// Where tokens are stored locally
export const TOKEN_FILE_PATH = `${process.env.HOME}/.jira-mcp-tokens.json`;

export const CHARACTER_LIMIT = 8000;
