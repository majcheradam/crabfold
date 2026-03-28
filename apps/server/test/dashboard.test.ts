import { beforeAll, describe, expect, test } from "bun:test";

import { BASE, authedHeaders, createAgent, getSessionCookie } from "./helpers";

let cookie: string;
let userId: string;
let agentId1: string;
let agentId2: string;

beforeAll(async () => {
  const session = await getSessionCookie(
    "test-dashboard@test.com",
    "Dashboard Test User"
  );
  ({ cookie } = session);
  ({ userId } = session);
  agentId1 = await createAgent(cookie, "dashboard test agent 1");
  agentId2 = await createAgent(cookie, "dashboard test agent 2");
}, 120_000);

describe("GET /api/agents?userId=xxx", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents?userId=${userId}`);
    expect(res.status).toBe(401);
  });

  test("returns 403 for other user's agents", async () => {
    const res = await fetch(`${BASE}/api/agents?userId=some-other-user-id`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(403);
  });

  test("returns 4xx without userId param", async () => {
    const res = await fetch(`${BASE}/api/agents`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("returns agent list with correct shape", async () => {
    const res = await fetch(`${BASE}/api/agents?userId=${userId}`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.agents)).toBe(true);
    expect(data.agents.length).toBeGreaterThan(0);

    const [agent] = data.agents;
    expect(typeof agent.id).toBe("string");
    expect(typeof agent.slug).toBe("string");
    expect(typeof agent.name).toBe("string");
    expect(typeof agent.fork).toBe("string");
    expect(typeof agent.status).toBe("string");
    expect(typeof agent.lastActive).toBe("string");
    expect(typeof agent.threadCount).toBe("number");
  });

  test("draft agents have null health and 0 threadCount", async () => {
    const res = await fetch(`${BASE}/api/agents?userId=${userId}`, {
      headers: authedHeaders(cookie, false),
    });
    const data = await res.json();

    const draft = data.agents.find(
      (a: { status: string }) => a.status === "draft"
    );
    expect(draft).toBeDefined();
    expect(draft.health).toBeNull();
    expect(draft.threadCount).toBe(0);
  });

  test("lists both created agents", async () => {
    const res = await fetch(`${BASE}/api/agents?userId=${userId}`, {
      headers: authedHeaders(cookie, false),
    });
    const data = await res.json();

    const ids = data.agents.map((a: { id: string }) => a.id);
    expect(ids).toContain(agentId1);
    expect(ids).toContain(agentId2);
  });
});

describe("GET /api/agents/status", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/status`);
    expect(res.status).toBe(401);
  });

  test("returns statuses object", async () => {
    const res = await fetch(`${BASE}/api/agents/status`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(typeof data.statuses).toBe("object");
    expect(data.statuses).not.toBeNull();
  });

  test("returns empty statuses for draft-only agents", async () => {
    const res = await fetch(`${BASE}/api/agents/status`, {
      headers: authedHeaders(cookie, false),
    });
    const data = await res.json();
    expect(Object.keys(data.statuses)).toHaveLength(0);
  });
});
