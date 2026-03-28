import { beforeAll, describe, expect, test } from "bun:test";

import { BASE, authedHeaders, createAgent, getSessionCookie } from "./helpers";

let cookie: string;
let agentId: string;

beforeAll(async () => {
  const session = await getSessionCookie(
    "test-agents@test.com",
    "Agents Test User"
  );
  ({ cookie } = session);
  agentId = await createAgent(cookie, "a simple weather agent");
}, 60_000);

describe("GET /api/agents/:id", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}`);
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/agents/nonexistent-id`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(404);
  });

  test("returns 200 with full agent data", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.id).toBe(agentId);
    expect(Array.isArray(data.files)).toBe(true);
    expect(Array.isArray(data.skills)).toBe(true);
    expect(typeof data.soul).toBe("string");
    expect(data.status).toBe("draft");
  });
});

describe("PATCH /api/agents/:id", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}`, {
      body: JSON.stringify({ name: "hacked" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    expect(res.status).toBe(401);
  });

  test("updates agent name", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}`, {
      body: JSON.stringify({ name: "Updated Weather Bot" }),
      headers: authedHeaders(cookie),
      method: "PATCH",
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.name).toBe("Updated Weather Bot");
    expect(data.saved).toBe(true);
  });

  test("updates soul and syncs SOUL.md", async () => {
    const newSoul =
      "You are an improved weather agent with forecasting skills.";
    const res = await fetch(`${BASE}/api/agents/${agentId}`, {
      body: JSON.stringify({ soul: newSoul }),
      headers: authedHeaders(cookie),
      method: "PATCH",
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.soul).toBe(newSoul);

    const soulFile = data.files?.find(
      (f: { path: string }) => f.path === "SOUL.md"
    );
    expect(soulFile).toBeDefined();
    expect(soulFile.content).toBe(newSoul);
  });

  test("handles empty body gracefully", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}`, {
      body: JSON.stringify({}),
      headers: authedHeaders(cookie),
      method: "PATCH",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.saved).toBe(true);
  });
});

describe("PATCH /api/agents/:id/skills", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/skills`, {
      body: JSON.stringify({ enable: ["web-search"] }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    expect(res.status).toBe(401);
  });

  test("enables skills", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/skills`, {
      body: JSON.stringify({ enable: ["web-search", "calendar"] }),
      headers: authedHeaders(cookie),
      method: "PATCH",
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.skills).toContain("web-search");
    expect(data.skills).toContain("calendar");
  });

  test("disables skills", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/skills`, {
      body: JSON.stringify({ disable: ["calendar"] }),
      headers: authedHeaders(cookie),
      method: "PATCH",
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.skills).not.toContain("calendar");
    expect(data.skills).toContain("web-search");
  });
});

describe("POST /api/agents/:id/fork", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/fork`, {
      body: JSON.stringify({ from: "openclaw", to: "nanobot" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("switches to nanobot", async () => {
    const current = await fetch(`${BASE}/api/agents/${agentId}`, {
      headers: authedHeaders(cookie, false),
    });
    const currentData = await current.json();

    const res = await fetch(`${BASE}/api/agents/${agentId}/fork`, {
      body: JSON.stringify({ from: currentData.fork, to: "nanobot" }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.newFiles)).toBe(true);
    expect(data.newFiles.length).toBeGreaterThan(0);
    expect(data.warnings).toHaveLength(0);
  });

  test("switches to ironclaw with Postgres warning", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/fork`, {
      body: JSON.stringify({ from: "nanobot", to: "ironclaw" }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.newFiles)).toBe(true);
    expect(
      data.warnings.some((w: string) => w.toLowerCase().includes("postgres"))
    ).toBe(true);

    // Verify agent record was updated
    const updated = await fetch(`${BASE}/api/agents/${agentId}`, {
      headers: authedHeaders(cookie, false),
    });
    const updatedData = await updated.json();
    expect(updatedData.fork).toBe("ironclaw");
  });
});
