import fs from "fs";
import { TOKEN_FILE_PATH, ATLASSIAN_TOKEN_URL } from "../constants.js";
import type { StoredTokens, OAuthTokens } from "../types.js";

export function loadTokens(): StoredTokens | null {
  try {
    if (!fs.existsSync(TOKEN_FILE_PATH)) return null;
    const raw = fs.readFileSync(TOKEN_FILE_PATH, "utf-8");
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: StoredTokens): void {
  fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export function isTokenExpired(tokens: StoredTokens): boolean {
  // Refresh 5 minutes before expiry
  return Date.now() > tokens.expires_at - 5 * 60 * 1000;
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<OAuthTokens> {
  const response = await fetch(ATLASSIAN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${error}`);
  }

  return response.json() as Promise<OAuthTokens>;
}

export async function getValidTokens(
  clientId: string,
  clientSecret: string
): Promise<StoredTokens> {
  const stored = loadTokens();

  if (!stored) {
    throw new Error(
      "Not authenticated. Run 'npm run auth' first to log in with your SSO credentials."
    );
  }

  if (!isTokenExpired(stored)) {
    return stored;
  }

  // Token expired — try to refresh
  if (!stored.refresh_token) {
    throw new Error(
      "Session expired and no refresh token available. Run 'npm run auth' to log in again."
    );
  }

  const refreshed = await refreshAccessToken(stored.refresh_token, clientId, clientSecret);

  const updated: StoredTokens = {
    ...stored,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? stored.refresh_token,
    expires_at: Date.now() + refreshed.expires_in * 1000
  };

  saveTokens(updated);
  return updated;
}
