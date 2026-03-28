import { beforeAll, describe, expect, test } from "bun:test";

import { BASE, authedHeaders, createAgent, getSessionCookie } from "./helpers";

let cookie: string;
let agentId: string;

beforeAll(async () => {
  const session = await getSessionCookie(
    "test-deploy@test.com",
    "Deploy Test User"
  );
  ({ cookie } = session);
  agentId = await createAgent(cookie, "a deploy test agent");
}, 60_000);

describe("POST /api/agents/:id/deploy", () => {
  test("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/deploy`, {
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/agents/nonexistent-id/deploy`, {
      body: JSON.stringify({}),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  test("returns 403 with RAILWAY_NOT_CONNECTED when no Railway account", async () => {
    const res = await fetch(`${BASE}/api/agents/${agentId}/deploy`, {
      body: JSON.stringify({}),
      headers: authedHeaders(cookie),
      method: "POST",
    });
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.code).toBe("RAILWAY_NOT_CONNECTED");
  });
});
