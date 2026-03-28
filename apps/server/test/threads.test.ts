import { beforeAll, describe, expect, test } from "bun:test";

import { BASE, authedHeaders, createAgent, getSessionCookie } from "./helpers";

let cookie: string;
let agentId: string;

beforeAll(async () => {
  const session = await getSessionCookie(
    "test-threads@test.com",
    "Thread Test User"
  );
  ({ cookie } = session);
  agentId = await createAgent(cookie, "a thread test agent");
}, 60_000);

// ── List threads ────────────────────────────────────────────────

describe("GET /api/agents/:id/threads", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/threads`);
    expect(res.status).toBe(401);
  });

  test("returns 404 for missing agent", async () => {
    const res = await fetch(`${BASE}/api/agents/nonexistent-id/threads`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(404);
  });

  test("returns 400 for draft agent", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/threads`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Agent is not deployed");
  });
});

// ── Get thread history ──────────────────────────────────────────

describe("GET /api/agents/:id/threads/:tid", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(
      `${BASE}/api/agents/${agentId}/threads/some-thread`
    );
    expect(res.status).toBe(401);
  });

  test("returns 404 for missing agent", async () => {
    const res = await fetch(
      `${BASE}/api/agents/nonexistent-id/threads/some-thread`,
      { headers: authedHeaders(cookie, false) }
    );
    expect(res.status).toBe(404);
  });

  test("returns 400 for draft agent", async () => {
    const res = await fetch(
      `${BASE}/api/agents/${agentId}/threads/some-thread`,
      { headers: authedHeaders(cookie, false) }
    );
    expect(res.status).toBe(400);
  });
});

// ── Live SSE stream ─────────────────────────────────────────────

describe("GET /api/agents/:id/threads/:tid/live", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(
      `${BASE}/api/agents/${agentId}/threads/some-thread/live`
    );
    expect(res.status).toBe(401);
  });

  test("returns 404 for missing agent", async () => {
    const res = await fetch(
      `${BASE}/api/agents/nonexistent-id/threads/some-thread/live`,
      { headers: authedHeaders(cookie, false) }
    );
    expect(res.status).toBe(404);
  });

  test("returns 400 for draft agent", async () => {
    const res = await fetch(
      `${BASE}/api/agents/${agentId}/threads/some-thread/live`,
      { headers: authedHeaders(cookie, false) }
    );
    expect(res.status).toBe(400);
  });
});

// ── Inject ──────────────────────────────────────────────────────

describe("POST /api/agents/:id/threads/:tid/inject", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(
      `${BASE}/api/agents/${agentId}/threads/some-thread/inject`,
      {
        body: JSON.stringify({ message: "hello" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }
    );
    expect(res.status).toBe(401);
  });

  test("returns 404 for missing agent", async () => {
    const res = await fetch(
      `${BASE}/api/agents/nonexistent-id/threads/some-thread/inject`,
      {
        body: JSON.stringify({ message: "hello" }),
        headers: authedHeaders(cookie),
        method: "POST",
      }
    );
    expect(res.status).toBe(404);
  });

  test("returns 400 for draft agent", async () => {
    const res = await fetch(
      `${BASE}/api/agents/${agentId}/threads/some-thread/inject`,
      {
        body: JSON.stringify({ message: "hello" }),
        headers: authedHeaders(cookie),
        method: "POST",
      }
    );
    expect(res.status).toBe(400);
  });

  test("rejects missing message field", async () => {
    const res = await fetch(
      `${BASE}/api/agents/${agentId}/threads/some-thread/inject`,
      {
        body: JSON.stringify({}),
        headers: authedHeaders(cookie),
        method: "POST",
      }
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

// ── Control (pause/resume) ──────────────────────────────────────

describe("POST /api/agents/:id/control", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/control`, {
      body: JSON.stringify({ action: "pause" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("returns 404 for missing agent", async () => {
    const res = await fetch(`${BASE}/api/agents/nonexistent-id/control`, {
      body: JSON.stringify({ action: "pause" }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  test("returns 400 for draft agent", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/control`, {
      body: JSON.stringify({ action: "pause" }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(400);
  });

  test("rejects invalid action", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/control`, {
      body: JSON.stringify({ action: "explode" }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("rejects missing action", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/control`, {
      body: JSON.stringify({}),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
