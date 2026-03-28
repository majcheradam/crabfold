import { beforeAll, describe, expect, test } from "bun:test";

import { BASE, authedHeaders, createAgent, getSessionCookie } from "./helpers";

let cookie: string;
let agentId: string;

beforeAll(async () => {
  const session = await getSessionCookie(
    "test-gateway@test.com",
    "Gateway Test User"
  );
  ({ cookie } = session);
  agentId = await createAgent(cookie, "a test agent for gateway");
}, 60_000);

// ── Gateway ─────────────────────────────────────────────────────

describe("POST /gateway/:agentId/chat", () => {
  test("returns 401 without API key", async () => {
    const res = await fetch(`${BASE}/gateway/some-agent-id/chat`, {
      body: JSON.stringify({ message: "hello" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(401);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe("Missing API key");
  });

  test("returns 401 with invalid API key", async () => {
    const res = await fetch(`${BASE}/gateway/some-agent-id/chat`, {
      body: JSON.stringify({ message: "hello" }),
      headers: {
        Authorization: "Bearer cb_invalid_key_12345",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    expect(res.status).toBe(401);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe("Invalid or revoked API key");
  });

  test("returns 403 when API key does not match agent", async () => {
    // Create a key for agentId
    const keyRes = await fetch(`${BASE}/api/agents/${agentId}/keys`, {
      body: JSON.stringify({ label: "gateway mismatch test" }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    const keyData = (await keyRes.json()) as { key: string };

    // Use the key against a different agentId
    const res = await fetch(`${BASE}/gateway/wrong-agent-id/chat`, {
      body: JSON.stringify({ message: "hello" }),
      headers: {
        Authorization: `Bearer ${keyData.key}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe("API key does not match agent");
  });

  test("returns 503 when agent is not deployed", async () => {
    // Create a key for the test agent (which is in draft status)
    const keyRes = await fetch(`${BASE}/api/agents/${agentId}/keys`, {
      body: JSON.stringify({ label: "gateway not-deployed test" }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    const keyData = (await keyRes.json()) as { key: string };

    const res = await fetch(`${BASE}/gateway/${agentId}/chat`, {
      body: JSON.stringify({ message: "hello" }),
      headers: {
        Authorization: `Bearer ${keyData.key}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    expect(res.status).toBe(503);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe("Agent is not deployed");
  });

  test("accepts api_key in request body", async () => {
    const res = await fetch(`${BASE}/gateway/some-agent-id/chat`, {
      body: JSON.stringify({
        api_key: "cb_invalid_body_key",
        message: "hello",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    // Should get 401 (invalid key) rather than missing key
    expect(res.status).toBe(401);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe("Invalid or revoked API key");
  });
});

// ── Observability ───────────────────────────────────────────────

describe("GET /api/agents/:id/metrics", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/some-id/metrics?range=24h`);
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent agent", async () => {
    const res = await fetch(
      `${BASE}/api/agents/nonexistent-id/metrics?range=24h`,
      { headers: authedHeaders(cookie, false) }
    );
    expect(res.status).toBe(404);
  });

  test("returns metrics for existing agent", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/metrics?range=24h`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.agentId).toBe(agentId);
    expect(typeof data.totalTokens).toBe("number");
    expect(typeof data.avgLatencyMs).toBe("number");
  });
});

describe("GET /api/agents/:id/traces", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/some-id/traces?limit=20`);
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent agent", async () => {
    const res = await fetch(
      `${BASE}/api/agents/nonexistent-id/traces?limit=20`,
      { headers: authedHeaders(cookie, false) }
    );
    expect(res.status).toBe(404);
  });

  test("returns traces for existing agent", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/traces?limit=20`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { traces: unknown[] };
    expect(Array.isArray(data.traces)).toBe(true);
  });
});

describe("GET /api/agents/:id/traces/:traceId", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/some-id/traces/some-trace-id`);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/agents/:id/metrics/live", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/some-id/metrics/live`);
    expect(res.status).toBe(401);
  });
});
