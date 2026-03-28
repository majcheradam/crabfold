import { beforeAll, describe, expect, test } from "bun:test";

import { BASE, authedHeaders, createAgent, getSessionCookie } from "./helpers";

let cookie: string;
let agentId: string;

beforeAll(async () => {
  const session = await getSessionCookie(
    "test-connectors@test.com",
    "Connectors Test User"
  );
  ({ cookie } = session);
  agentId = await createAgent(cookie, "a test agent for connectors");
}, 60_000);

// ── Skill Search ───────────────────────────────────────────────

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
    const data = (await res.json()) as { skills: unknown[] };
    expect(Array.isArray(data.skills)).toBe(true);
  });

  test("supports category filter", async () => {
    const res = await fetch(`${BASE}/api/connectors/skills?category=tools`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { skills: unknown[] };
    expect(Array.isArray(data.skills)).toBe(true);
  });
});

// ── Installed Skills per Agent ─────────────────────────────────

describe("GET /api/connectors/skills/:agentId", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/connectors/skills/${agentId}`);
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/connectors/skills/nonexistent-agent`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(404);
  });

  test("returns empty skills list for fresh agent", async () => {
    const res = await fetch(`${BASE}/api/connectors/skills/${agentId}`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { skills: unknown[] };
    expect(Array.isArray(data.skills)).toBe(true);
  });
});

// ── Skill Install ──────────────────────────────────────────────

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

  test("installs a skill on an agent", async () => {
    const res = await fetch(`${BASE}/api/connectors/install`, {
      body: JSON.stringify({
        agentId,
        skillId: "test-skill-1",
      }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.installed).toBe(true);
    expect(Array.isArray(data.tools)).toBe(true);
  });

  test("returns installed: true for already installed skill", async () => {
    const res = await fetch(`${BASE}/api/connectors/install`, {
      body: JSON.stringify({
        agentId,
        skillId: "test-skill-1",
      }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.installed).toBe(true);
    expect(data.message).toBe("Skill already installed");
  });

  test("installed skill appears in skills list", async () => {
    const res = await fetch(`${BASE}/api/connectors/skills/${agentId}`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      skills: { skillId: string }[];
    };
    const found = data.skills.some((s) => s.skillId === "test-skill-1");
    expect(found).toBe(true);
  });
});

// ── Skill Uninstall ────────────────────────────────────────────

describe("DELETE /api/connectors/uninstall", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/connectors/uninstall`, {
      body: JSON.stringify({ agentId: "test", skillId: "test" }),
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/connectors/uninstall`, {
      body: JSON.stringify({
        agentId: "nonexistent-agent",
        skillId: "test-skill-1",
      }),
      headers: authedHeaders(cookie),
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  test("uninstalls a skill from an agent", async () => {
    // Install first
    await fetch(`${BASE}/api/connectors/install`, {
      body: JSON.stringify({ agentId, skillId: "skill-to-remove" }),
      headers: authedHeaders(cookie),
      method: "POST",
    });

    // Uninstall
    const res = await fetch(`${BASE}/api/connectors/uninstall`, {
      body: JSON.stringify({ agentId, skillId: "skill-to-remove" }),
      headers: authedHeaders(cookie),
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.uninstalled).toBe(true);

    // Verify removed from list
    const listRes = await fetch(`${BASE}/api/connectors/skills/${agentId}`, {
      headers: authedHeaders(cookie, false),
    });
    const listData = (await listRes.json()) as {
      skills: { skillId: string }[];
    };
    const found = listData.skills.some((s) => s.skillId === "skill-to-remove");
    expect(found).toBe(false);
  });
});

// ── MCP Connections ────────────────────────────────────────────

describe("GET /api/connectors/mcp/:agentId", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/connectors/mcp/${agentId}`);
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/connectors/mcp/nonexistent-agent`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(404);
  });

  test("returns empty connections list for fresh agent", async () => {
    const res = await fetch(`${BASE}/api/connectors/mcp/${agentId}`, {
      headers: authedHeaders(cookie, false),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { connections: unknown[] };
    expect(Array.isArray(data.connections)).toBe(true);
    expect(data.connections.length).toBe(0);
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

  test("returns 422 for unreachable MCP server", async () => {
    const res = await fetch(`${BASE}/api/connectors/mcp`, {
      body: JSON.stringify({
        agentId,
        name: "bad-server",
        url: "https://mcp.nonexistent-domain-12345.com/sse",
      }),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(422);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe("MCP server unreachable");
  });
});

describe("DELETE /api/connectors/mcp", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/connectors/mcp`, {
      body: JSON.stringify({
        agentId: "test",
        connectionId: "test",
      }),
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/connectors/mcp`, {
      body: JSON.stringify({
        agentId: "nonexistent-agent",
        connectionId: "test",
      }),
      headers: authedHeaders(cookie),
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  test("returns 404 for non-existent connection", async () => {
    const res = await fetch(`${BASE}/api/connectors/mcp`, {
      body: JSON.stringify({
        agentId,
        connectionId: "nonexistent-connection",
      }),
      headers: authedHeaders(cookie),
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
