import { beforeAll, describe, expect, test } from "bun:test";

import { BASE, authedHeaders, getSessionCookie } from "./helpers";

let cookie: string;

beforeAll(async () => {
  const session = await getSessionCookie(
    "test-gateway@test.com",
    "Gateway Test User"
  );
  ({ cookie } = session);
}, 30_000);

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
});

// ── Connectors ──────────────────────────────────────────────────

describe("GET /api/connectors/skills", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/connectors/skills`);
    expect(res.status).toBe(401);
  });

  test("returns skills array for search", async () => {
    const res = await fetch(`${BASE}/api/connectors/skills?q=web+search`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(Array.isArray(data.skills)).toBe(true);
  });
});

describe("POST /api/connectors/install", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/connectors/install`, {
      body: JSON.stringify({ agentId: "test", skillId: "test" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/connectors/install`, {
      body: JSON.stringify({
        agentId: "nonexistent-agent",
        skillId: "web-search",
      }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/connectors/uninstall", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/connectors/uninstall`, {
      body: JSON.stringify({ agentId: "test", skillId: "test" }),
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/connectors/mcp", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/connectors/mcp`, {
      body: JSON.stringify({
        agentId: "test",
        name: "stripe",
        url: "https://mcp.stripe.com/sse",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/connectors/mcp`, {
      body: JSON.stringify({
        agentId: "nonexistent-agent",
        name: "stripe",
        url: "https://mcp.stripe.com/sse",
      }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(404);
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
