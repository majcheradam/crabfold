import { beforeAll, describe, expect, test } from "bun:test";

import { BASE, authedHeaders, createAgent, getSessionCookie } from "./helpers";

let cookie: string;
let agentId: string;

beforeAll(async () => {
  const session = await getSessionCookie(
    "test-apikeys@test.com",
    "API Keys Test User"
  );
  ({ cookie } = session);
  agentId = await createAgent(cookie, "a test agent for api keys");
}, 60_000);

// ── API Key Management ─────────────────────────────────────────

describe("POST /api/agents/:id/keys", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/keys`, {
      body: JSON.stringify({ label: "test key" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/agents/nonexistent-agent/keys`, {
      body: JSON.stringify({ label: "test key" }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  test("creates an API key and returns the raw key once", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/keys`, {
      body: JSON.stringify({ label: "My Test Key" }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.label).toBe("My Test Key");
    expect(data.rateLimit).toBe(60);
    expect(typeof data.key).toBe("string");
    expect((data.key as string).startsWith("cb_")).toBe(true);
    expect(typeof data.keyPrefix).toBe("string");
    expect(typeof data.id).toBe("string");
  });

  test("creates an API key with custom rate limit", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/keys`, {
      body: JSON.stringify({ label: "High Rate Key", rateLimit: 1000 }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.rateLimit).toBe(1000);
  });
});

describe("GET /api/agents/:id/keys", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/keys`);
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/agents/nonexistent-agent/keys`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(404);
  });

  test("lists API keys without exposing the raw key", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/keys`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { keys: Record<string, unknown>[] };
    expect(Array.isArray(data.keys)).toBe(true);
    // created 2 above
    expect(data.keys.length).toBeGreaterThanOrEqual(2);
    for (const key of data.keys) {
      expect(typeof key.id).toBe("string");
      expect(typeof key.keyPrefix).toBe("string");
      expect(typeof key.label).toBe("string");
      // Raw key must NOT be included in list response
      expect(key.key).toBeUndefined();
      expect(key.keyHash).toBeUndefined();
    }
  });
});

describe("DELETE /api/agents/:id/keys/:keyId", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/keys/some-key-id`, {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent key", async () => {
    const res = await fetch(
      `${BASE}/api/agents/${agentId}/keys/nonexistent-key`,
      {
        headers: authedHeaders(cookie, false),
        method: "DELETE",
      }
    );
    expect(res.status).toBe(404);
  });

  test("revokes an existing API key", async () => {
    // Create a key to revoke
    const createRes = await fetch(`${BASE}/api/agents/${agentId}/keys`, {
      body: JSON.stringify({ label: "Key to Revoke" }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    const created = (await createRes.json()) as { id: string; key: string };

    // Revoke it
    const revokeRes = await fetch(
      `${BASE}/api/agents/${agentId}/keys/${created.id}`,
      {
        headers: authedHeaders(cookie, false),
        method: "DELETE",
      }
    );
    expect(revokeRes.status).toBe(200);
    const data = (await revokeRes.json()) as Record<string, unknown>;
    expect(data.revoked).toBe(true);

    // Verify the revoked key no longer works on the gateway
    const gatewayRes = await fetch(`${BASE}/gateway/${agentId}/chat`, {
      body: JSON.stringify({ message: "hello" }),
      headers: {
        Authorization: `Bearer ${created.key}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    expect(gatewayRes.status).toBe(401);
    const gwData = (await gatewayRes.json()) as Record<string, unknown>;
    expect(gwData.error).toBe("Invalid or revoked API key");
  });
});
