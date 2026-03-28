import { createAuthClient } from "better-auth/react";

const BASE = "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: BASE,
});

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

async function getSessionCookie(): Promise<{ cookie: string; userId: string }> {
  // Sign up a test user via email/password (ignore if already exists)
  const signUp = await authClient.signUp.email({
    email: "dashboard-test@test.com",
    name: "Dashboard Test User",
    password: "password123",
  });
  if (signUp.error) {
    console.log("Sign up skipped:", signUp.error.message);
  } else {
    console.log("Sign up:", signUp.data?.user.email);
  }

  // Sign in and capture the set-cookie header
  let sessionCookie = "";
  await authClient.signIn.email({
    email: "dashboard-test@test.com",
    fetchOptions: {
      onSuccess: (ctx) => {
        const setCookie = ctx.response.headers.get("set-cookie");
        if (setCookie) {
          [sessionCookie] = setCookie.split(";");
        }
      },
    },
    password: "password123",
  });

  if (!sessionCookie) {
    console.error("No session cookie received");
    process.exit(1);
  }

  // Get user ID from session
  const sessionRes = await fetch(`${BASE}/api/auth/get-session`, {
    headers: { Cookie: sessionCookie },
  });
  const sessionData = await sessionRes.json();
  const userId = sessionData.user.id;

  console.log("Session cookie:", sessionCookie);
  console.log("User ID:", userId);
  return { cookie: sessionCookie, userId };
}

function headers(cookie: string, json = true) {
  const h: Record<string, string> = { Cookie: cookie };
  if (json) {
    h["Content-Type"] = "application/json";
  }
  return h;
}

// ── Helpers ──────────────────────────────────────────────────────

async function createAgent(cookie: string): Promise<string> {
  console.log("\n=== Creating agent for dashboard tests ===");
  const createRes = await fetch(`${BASE}/api/agents/create`, {
    body: JSON.stringify({ prompt: "a dashboard test agent" }),
    headers: headers(cookie),
    method: "POST",
  });
  const createData = await createRes.json();
  assert(!!createData.jobId, "POST /create returns jobId");

  // Stream SSE until "complete" event with agentId
  const streamRes = await fetch(`${BASE}/api/jobs/${createData.jobId}/stream`);
  const reader = streamRes.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    console.error("No stream reader");
    process.exit(1);
  }

  let agentId = "";
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data:")) {
        const raw = line.slice(5).trim();
        if (!raw) {
          continue;
        }
        try {
          const evt = JSON.parse(raw);
          console.log("SSE:", evt.label ?? evt.event ?? "unknown");
          if (evt.event === "complete" && evt.data?.agentId) {
            ({ agentId } = evt.data);
          }
          if (evt.event === "error") {
            console.error("Scaffold error:", evt.data?.message);
            process.exit(1);
          }
        } catch {
          // not JSON, skip
        }
      }
    }
  }

  assert(!!agentId, "Scaffold returned agentId");
  console.log("Agent ID:", agentId);
  return agentId;
}

// ── Tests ────────────────────────────────────────────────────────

async function testListAgents(cookie: string, userId: string) {
  console.log("\n=== GET /api/agents?userId=xxx ===");

  // 401 without cookie
  const noAuth = await fetch(`${BASE}/api/agents?userId=${userId}`);
  assert(noAuth.status === 401, "GET /agents without auth returns 401");

  // 403 for different userId
  const forbidden = await fetch(
    `${BASE}/api/agents?userId=some-other-user-id`,
    {
      headers: headers(cookie, false),
    }
  );
  assert(forbidden.status === 403, "GET /agents for other user returns 403");

  // 200 for own agents
  const res = await fetch(`${BASE}/api/agents?userId=${userId}`, {
    headers: headers(cookie, false),
  });
  assert(res.status === 200, "GET /agents returns 200");

  const data = await res.json();
  assert(Array.isArray(data.agents), "Response contains agents array");
  assert(data.agents.length > 0, "Agents array is non-empty");

  const [firstAgent] = data.agents;
  assert(typeof firstAgent.id === "string", "Agent has id");
  assert(typeof firstAgent.slug === "string", "Agent has slug");
  assert(typeof firstAgent.name === "string", "Agent has name");
  assert(typeof firstAgent.fork === "string", "Agent has fork");
  assert(typeof firstAgent.status === "string", "Agent has status");
  assert(typeof firstAgent.lastActive === "string", "Agent has lastActive");
  assert(typeof firstAgent.threadCount === "number", "Agent has threadCount");

  // Draft agents should have null health
  const draftAgent = data.agents.find(
    (a: { status: string }) => a.status === "draft"
  );
  if (draftAgent) {
    assert(draftAgent.health === null, "Draft agent has null health");
    assert(draftAgent.threadCount === 0, "Draft agent has 0 threadCount");
  }

  return data.agents;
}

async function testListAgentsValidation(cookie: string) {
  console.log("\n=== GET /api/agents (missing userId param) ===");

  // Missing userId query param should fail validation
  const noParam = await fetch(`${BASE}/api/agents`, {
    headers: headers(cookie, false),
  });
  assert(
    noParam.status === 422 || noParam.status === 400,
    `GET /agents without userId param returns 4xx (got ${noParam.status})`
  );
}

async function testAgentStatus(cookie: string) {
  console.log("\n=== GET /api/agents/status ===");

  // 401 without cookie
  const noAuth = await fetch(`${BASE}/api/agents/status`);
  assert(noAuth.status === 401, "GET /agents/status without auth returns 401");

  // 200 with auth
  const res = await fetch(`${BASE}/api/agents/status`, {
    headers: headers(cookie, false),
  });
  assert(res.status === 200, "GET /agents/status returns 200");

  const data = await res.json();
  assert(
    typeof data.statuses === "object" && data.statuses !== null,
    "Response contains statuses object"
  );

  // Since our test agents are drafts, statuses should be empty
  assert(
    Object.keys(data.statuses).length === 0,
    "No statuses for draft-only agents"
  );
}

async function testListAgentsMultiple(
  cookie: string,
  userId: string,
  agentIds: string[]
) {
  console.log("\n=== GET /api/agents?userId=xxx (multiple agents) ===");

  const res = await fetch(`${BASE}/api/agents?userId=${userId}`, {
    headers: headers(cookie, false),
  });
  assert(res.status === 200, "GET /agents returns 200");

  const data = await res.json();
  assert(
    data.agents.length >= agentIds.length,
    `Expected at least ${agentIds.length} agents, got ${data.agents.length}`
  );

  for (const id of agentIds) {
    const found = data.agents.find((a: { id: string }) => a.id === id);
    assert(!!found, `Agent ${id} found in list`);
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const { cookie, userId } = await getSessionCookie();

  // Create two agents to test listing
  const agentId1 = await createAgent(cookie);
  const agentId2 = await createAgent(cookie);

  await testListAgents(cookie, userId);
  await testListAgentsValidation(cookie);
  await testAgentStatus(cookie);
  await testListAgentsMultiple(cookie, userId, [agentId1, agentId2]);

  console.log("\n✅ All dashboard tests passed!");
  process.exit(0);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
