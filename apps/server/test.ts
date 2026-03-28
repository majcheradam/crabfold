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

async function getSessionCookie(): Promise<string> {
  // Sign up a test user via email/password (ignore if already exists)
  const signUp = await authClient.signUp.email({
    email: "test@test.com",
    name: "Test User",
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
    email: "test@test.com",
    fetchOptions: {
      onSuccess: (ctx) => {
        const setCookie = ctx.response.headers.get("set-cookie");
        if (setCookie) {
          sessionCookie = setCookie.split(";")[0];
        }
      },
    },
    password: "password123",
  });

  if (!sessionCookie) {
    console.error("No session cookie received");
    process.exit(1);
  }
  console.log("Session cookie:", sessionCookie);
  return sessionCookie;
}

function headers(cookie: string, json = true) {
  const h: Record<string, string> = { Cookie: cookie };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

// ── Helpers ──────────────────────────────────────────────────────

async function createAgent(cookie: string): Promise<string> {
  console.log("\n=== Creating agent via scaffold ===");
  const createRes = await fetch(`${BASE}/api/agents/create`, {
    body: JSON.stringify({ prompt: "a simple weather agent" }),
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
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE lines
    const lines = buffer.split("\n");
    buffer = lines.pop()!; // keep incomplete line
    for (const line of lines) {
      if (line.startsWith("data:")) {
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try {
          const evt = JSON.parse(raw);
          console.log("SSE:", evt.label ?? evt.event ?? "unknown");
          if (evt.event === "complete" && evt.data?.agentId) {
            agentId = evt.data.agentId;
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

async function testGetAgent(cookie: string, agentId: string) {
  console.log("\n=== GET /api/agents/:id ===");

  // 401 without cookie
  const noAuth = await fetch(`${BASE}/api/agents/${agentId}`);
  assert(noAuth.status === 401, "GET without auth returns 401");

  // 404 for non-existent
  const notFound = await fetch(`${BASE}/api/agents/nonexistent-id`, {
    headers: headers(cookie, false),
  });
  assert(notFound.status === 404, "GET non-existent agent returns 404");

  // 200 for owned agent
  const res = await fetch(`${BASE}/api/agents/${agentId}`, {
    headers: headers(cookie, false),
  });
  assert(res.status === 200, "GET owned agent returns 200");

  const data = await res.json();
  assert(data.id === agentId, "Response contains correct agent id");
  assert(Array.isArray(data.files), "Response contains files array");
  assert(Array.isArray(data.skills), "Response contains skills array");
  assert(typeof data.soul === "string", "Response contains soul string");
  assert(data.status === "draft", "Agent status is draft");

  return data;
}

async function testPatchAgent(cookie: string, agentId: string) {
  console.log("\n=== PATCH /api/agents/:id ===");

  // 401 without cookie
  const noAuth = await fetch(`${BASE}/api/agents/${agentId}`, {
    body: JSON.stringify({ name: "hacked" }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  assert(noAuth.status === 401, "PATCH without auth returns 401");

  // Update name only
  const nameRes = await fetch(`${BASE}/api/agents/${agentId}`, {
    body: JSON.stringify({ name: "Updated Weather Bot" }),
    headers: headers(cookie),
    method: "PATCH",
  });
  assert(nameRes.status === 200, "PATCH name returns 200");
  const nameData = await nameRes.json();
  assert(nameData.name === "Updated Weather Bot", "Name was updated");
  assert(nameData.saved === true, "Response has saved: true");

  // Update soul — should sync SOUL.md in files
  const newSoul = "You are an improved weather agent with forecasting skills.";
  const soulRes = await fetch(`${BASE}/api/agents/${agentId}`, {
    body: JSON.stringify({ soul: newSoul }),
    headers: headers(cookie),
    method: "PATCH",
  });
  assert(soulRes.status === 200, "PATCH soul returns 200");
  const soulData = await soulRes.json();
  assert(soulData.soul === newSoul, "Soul was updated");

  const soulFile = soulData.files?.find(
    (f: { path: string }) => f.path === "SOUL.md"
  );
  assert(!!soulFile, "SOUL.md file exists in files array");
  assert(soulFile.content === newSoul, "SOUL.md content matches new soul");

  // No-op update (empty body)
  const noopRes = await fetch(`${BASE}/api/agents/${agentId}`, {
    body: JSON.stringify({}),
    headers: headers(cookie),
    method: "PATCH",
  });
  assert(noopRes.status === 200, "PATCH empty body returns 200");
  const noopData = await noopRes.json();
  assert(noopData.saved === true, "No-op returns saved: true");
}

async function testToggleSkills(cookie: string, agentId: string) {
  console.log("\n=== PATCH /api/agents/:id/skills ===");

  // 401 without cookie
  const noAuth = await fetch(`${BASE}/api/agents/${agentId}/skills`, {
    body: JSON.stringify({ enable: ["web-search"] }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  assert(noAuth.status === 401, "Skills PATCH without auth returns 401");

  // Get current skills
  const before = await fetch(`${BASE}/api/agents/${agentId}`, {
    headers: headers(cookie, false),
  });
  const beforeData = await before.json();
  const originalSkills: string[] = beforeData.skills;
  console.log("Original skills:", originalSkills);

  // Enable a new skill
  const enableRes = await fetch(`${BASE}/api/agents/${agentId}/skills`, {
    body: JSON.stringify({ enable: ["web-search", "calendar"] }),
    headers: headers(cookie),
    method: "PATCH",
  });
  assert(enableRes.status === 200, "Enable skills returns 200");
  const enableData = await enableRes.json();
  assert(
    enableData.skills.includes("web-search"),
    "web-search skill was enabled"
  );
  assert(enableData.skills.includes("calendar"), "calendar skill was enabled");

  // Disable a skill
  const disableRes = await fetch(`${BASE}/api/agents/${agentId}/skills`, {
    body: JSON.stringify({ disable: ["calendar"] }),
    headers: headers(cookie),
    method: "PATCH",
  });
  assert(disableRes.status === 200, "Disable skills returns 200");
  const disableData = await disableRes.json();
  assert(
    !disableData.skills.includes("calendar"),
    "calendar skill was disabled"
  );
  assert(
    disableData.skills.includes("web-search"),
    "web-search skill still enabled after disabling calendar"
  );

  // Verify files were regenerated (check agent has files)
  const after = await fetch(`${BASE}/api/agents/${agentId}`, {
    headers: headers(cookie, false),
  });
  const afterData = await after.json();
  assert(
    Array.isArray(afterData.files),
    "Files regenerated after skill toggle"
  );
  assert(afterData.files.length > 0, "Files array is non-empty");
}

async function testSwitchFork(cookie: string, agentId: string) {
  console.log("\n=== POST /api/agents/:id/fork ===");

  // 401 without cookie
  const noAuth = await fetch(`${BASE}/api/agents/${agentId}/fork`, {
    body: JSON.stringify({ from: "openclaw", to: "nanobot" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert(noAuth.status === 401, "Fork POST without auth returns 401");

  // Get current fork
  const current = await fetch(`${BASE}/api/agents/${agentId}`, {
    headers: headers(cookie, false),
  });
  const currentData = await current.json();
  const currentFork = currentData.fork;
  console.log("Current fork:", currentFork);

  // No-op: switch to same fork
  const noopRes = await fetch(`${BASE}/api/agents/${agentId}/fork`, {
    body: JSON.stringify({ from: currentFork, to: currentFork }),
    headers: headers(cookie),
    method: "POST",
  });
  assert(noopRes.status === 200, "Fork no-op returns 200");
  const noopData = await noopRes.json();
  assert(Array.isArray(noopData.warnings), "No-op has warnings array");
  assert(noopData.warnings.length === 0, "No-op has empty warnings");

  // Switch to nanobot
  const nanobotRes = await fetch(`${BASE}/api/agents/${agentId}/fork`, {
    body: JSON.stringify({ from: currentFork, to: "nanobot" }),
    headers: headers(cookie),
    method: "POST",
  });
  assert(nanobotRes.status === 200, "Switch to nanobot returns 200");
  const nanobotData = await nanobotRes.json();
  assert(Array.isArray(nanobotData.newFiles), "Response has newFiles array");
  assert(nanobotData.newFiles.length > 0, "newFiles is non-empty");
  assert(nanobotData.warnings.length === 0, "No warnings for nanobot");

  // Switch to ironclaw — should warn about Postgres
  const ironclawRes = await fetch(`${BASE}/api/agents/${agentId}/fork`, {
    body: JSON.stringify({ from: "nanobot", to: "ironclaw" }),
    headers: headers(cookie),
    method: "POST",
  });
  assert(ironclawRes.status === 200, "Switch to ironclaw returns 200");
  const ironclawData = await ironclawRes.json();
  assert(Array.isArray(ironclawData.newFiles), "Ironclaw has newFiles array");
  assert(
    ironclawData.warnings.some((w: string) =>
      w.toLowerCase().includes("postgres")
    ),
    "Ironclaw warns about Postgres"
  );

  // Verify agent record was updated
  const updated = await fetch(`${BASE}/api/agents/${agentId}`, {
    headers: headers(cookie, false),
  });
  const updatedData = await updated.json();
  assert(updatedData.fork === "ironclaw", "Agent fork updated to ironclaw");
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const cookie = await getSessionCookie();
  const agentId = await createAgent(cookie);

  await testGetAgent(cookie, agentId);
  await testPatchAgent(cookie, agentId);
  await testToggleSkills(cookie, agentId);
  await testSwitchFork(cookie, agentId);

  console.log("\n✅ All tests passed!");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
