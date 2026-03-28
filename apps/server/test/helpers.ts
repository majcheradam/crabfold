import { createAuthClient } from "better-auth/react";

const BASE = "http://localhost:3000";

export { BASE };

const authClient = createAuthClient({ baseURL: BASE });

export function authedHeaders(cookie: string, json = true) {
  const h: Record<string, string> = { Cookie: cookie };
  if (json) {
    h["Content-Type"] = "application/json";
  }
  return h;
}

export async function getSessionCookie(
  email: string,
  name: string
): Promise<{ cookie: string; userId: string }> {
  const signUp = await authClient.signUp.email({
    email,
    name,
    password: "password123",
  });
  if (signUp.error) {
    // User already exists — fine
  }

  let sessionCookie = "";
  await authClient.signIn.email({
    email,
    fetchOptions: {
      onSuccess: (ctx) => {
        const setCookie = ctx.response.headers.get("set-cookie");
        if (setCookie) {
          sessionCookie = setCookie.split(";")[0] ?? "";
        }
      },
    },
    password: "password123",
  });

  if (!sessionCookie) {
    throw new Error(`No session cookie received for ${email}`);
  }

  const sessionRes = await fetch(`${BASE}/api/auth/get-session`, {
    headers: { Cookie: sessionCookie },
  });
  const sessionData = (await sessionRes.json()) as { user: { id: string } };
  const userId = sessionData.user.id;

  return { cookie: sessionCookie, userId };
}

/**
 * Creates an agent via the scaffold endpoint and streams SSE until complete.
 * Returns the new agentId.
 */
export async function createAgent(
  cookie: string,
  prompt = "a test agent"
): Promise<string> {
  const createRes = await fetch(`${BASE}/api/agents/create`, {
    body: JSON.stringify({ prompt }),
    headers: authedHeaders(cookie),
    method: "POST",
  });
  const createData = (await createRes.json()) as { jobId?: string };
  if (!createData.jobId) {
    throw new Error("POST /create did not return jobId");
  }

  const streamRes = await fetch(`${BASE}/api/jobs/${createData.jobId}/stream`);
  const reader = streamRes.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error("No stream reader");
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
          if (evt.event === "complete" && evt.data?.agentId) {
            ({ agentId } = evt.data);
          }
          if (evt.event === "error") {
            throw new Error(`Scaffold error: ${evt.data?.message}`);
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.startsWith("Scaffold error")
          ) {
            throw error;
          }
        }
      }
    }
  }

  if (!agentId) {
    throw new Error("Scaffold stream completed without returning agentId");
  }

  return agentId;
}
