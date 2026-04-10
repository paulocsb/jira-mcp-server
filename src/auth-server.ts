/**
 * auth-server.ts
 *
 * Run once with: npm run auth
 * Opens your browser, you log in via SSO, and tokens are saved locally.
 */

import express from "express";
import { createServer } from "http";
import crypto from "crypto";
import {
  ATLASSIAN_AUTH_URL,
  ATLASSIAN_TOKEN_URL,
  ATLASSIAN_RESOURCES_URL,
  OAUTH_SCOPES,
  CALLBACK_PORT,
  CALLBACK_PATH,
  CALLBACK_URL
} from "./constants.js";
import { saveTokens } from "./services/token-store.js";
import type { OAuthTokens, AtlassianResource, StoredTokens } from "./types.js";

const CLIENT_ID = process.env.JIRA_CLIENT_ID;
const CLIENT_SECRET = process.env.JIRA_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌  Missing JIRA_CLIENT_ID or JIRA_CLIENT_SECRET environment variables.");
  console.error("    Set them in your shell or in a .env file before running auth.");
  process.exit(1);
}

const state = crypto.randomBytes(16).toString("hex");

const authUrl = new URL(ATLASSIAN_AUTH_URL);
authUrl.searchParams.set("audience", "api.atlassian.com");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("scope", OAUTH_SCOPES);
authUrl.searchParams.set("redirect_uri", CALLBACK_URL);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("prompt", "consent");
authUrl.searchParams.set("state", state);

const app = express();
const httpServer = createServer(app);

app.get(CALLBACK_PATH, async (req, res) => {
  const { code, state: returnedState, error } = req.query;

  if (error) {
    res.send(`<h1>❌ Auth Error</h1><p>${error}</p>`);
    shutdown();
    return;
  }

  if (returnedState !== state) {
    res.send("<h1>❌ State mismatch — possible CSRF attack</h1>");
    shutdown();
    return;
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(ATLASSIAN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: CALLBACK_URL
      })
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Token exchange failed: ${err}`);
    }

    const tokens = await tokenRes.json() as OAuthTokens;

    // Get accessible Jira cloud instances
    const resourcesRes = await fetch(ATLASSIAN_RESOURCES_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    if (!resourcesRes.ok) {
      throw new Error("Failed to fetch accessible resources");
    }

    const resources = await resourcesRes.json() as AtlassianResource[];

    if (resources.length === 0) {
      throw new Error("No Jira Cloud instances accessible for this account.");
    }

    // Use first cloud instance (most users only have one)
    const cloud = resources[0];

    const stored: StoredTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      cloud_id: cloud.id,
      cloud_url: cloud.url
    };

    saveTokens(stored);

    console.log(`\n✅ Authenticated successfully!`);
    console.log(`   Cloud: ${cloud.name} (${cloud.url})`);
    console.log(`   Tokens saved to ~/.jira-mcp-tokens.json\n`);

    res.send(`
      <h1>✅ Authenticated!</h1>
      <p>Connected to <strong>${cloud.name}</strong> (${cloud.url})</p>
      <p>You can close this tab and return to the terminal.</p>
    `);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ Auth error:", msg);
    res.send(`<h1>❌ Error</h1><p>${msg}</p>`);
  }

  shutdown();
});

function shutdown(): void {
  setTimeout(() => {
    httpServer.close();
    process.exit(0);
  }, 1000);
}

httpServer.listen(CALLBACK_PORT, async () => {
  console.log("🔐 Jira MCP OAuth Login");
  console.log("───────────────────────────────────────────");
  console.log(`Opening browser for SSO login...`);
  console.log(`If the browser doesn't open, visit:\n`);
  console.log(`  ${authUrl.toString()}\n`);

  // Try to open browser automatically
  try {
    const { default: open } = await import("open");
    await open(authUrl.toString());
  } catch {
    // browser open is optional
  }
});
