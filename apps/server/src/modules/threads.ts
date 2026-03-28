import { auth } from "@crabfold/auth";
import { eq, withUser } from "@crabfold/db";
import type { DbTransaction } from "@crabfold/db";
import { agent } from "@crabfold/db/schema/agent";
import { Elysia, t } from "elysia";

import { createThreadStore } from "../lib/thread-store";

async function getAuthedUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return null;
  }
  return session.user;
}

async function findAgent(tx: DbTransaction, agentId: string) {
  const [row] = await tx.select().from(agent).where(eq(agent.id, agentId));
  return row ?? null;
}

export const threadsModule = new Elysia({ prefix: "/api/agents" })
  // ── List threads for an agent ─────────────────────────────────
  .get(
    "/:id/threads",
    async ({ params, query, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const row = await withUser(user.id, (tx) => findAgent(tx, params.id));
      if (!row) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      if (row.status !== "live" || !row.deploymentUrl) {
        set.status = 400;
        return { error: "Agent is not deployed" };
      }

      const store = createThreadStore(row.fork);
      const limit = query.limit ?? 20;
      const sort = query.sort ?? "recent";

      const threads = await store.listThreads(row.deploymentUrl, {
        limit,
        sort,
      });

      return { threads };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        limit: t.Optional(t.Numeric({ default: 20 })),
        sort: t.Optional(t.String({ default: "recent" })),
      }),
    }
  )

  // ── Get full thread history ───────────────────────────────────
  .get(
    "/:id/threads/:tid",
    async ({ params, query, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const row = await withUser(user.id, (tx) => findAgent(tx, params.id));
      if (!row) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      if (row.status !== "live" || !row.deploymentUrl) {
        set.status = 400;
        return { error: "Agent is not deployed" };
      }

      const store = createThreadStore(row.fork);
      const limit = query.limit ?? 100;

      const history = await store.getHistory(row.deploymentUrl, params.tid, {
        limit,
      });

      if (!history) {
        set.status = 404;
        return { error: "Thread not found" };
      }

      return history;
    },
    {
      params: t.Object({ id: t.String(), tid: t.String() }),
      query: t.Object({
        limit: t.Optional(t.Numeric({ default: 100 })),
      }),
    }
  )

  // ── Live SSE stream for a thread ──────────────────────────────
  .get(
    "/:id/threads/:tid/live",
    async ({ params, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const row = await withUser(user.id, (tx) => findAgent(tx, params.id));
      if (!row) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      if (row.status !== "live" || !row.deploymentUrl) {
        set.status = 400;
        return { error: "Agent is not deployed" };
      }

      const wsUrl = `${row.deploymentUrl.replace(/^http/, "ws")}/ws/threads/${params.tid}`;

      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();

            const send = (event: string, data: unknown) => {
              controller.enqueue(
                encoder.encode(
                  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
                )
              );
            };

            let ws: WebSocket | null = null;

            try {
              ws = new WebSocket(wsUrl);

              ws.addEventListener("open", () => {
                send("connected", {
                  agentId: params.id,
                  threadId: params.tid,
                });
              });

              ws.addEventListener("message", (event) => {
                try {
                  const msg = JSON.parse(
                    typeof event.data === "string"
                      ? event.data
                      : event.data.toString()
                  );

                  if (msg.type === "message") {
                    send("message_added", {
                      content: msg.content,
                      role: msg.role,
                      timestamp: msg.timestamp,
                      toolCalls: msg.toolCalls,
                    });
                  } else if (msg.type === "tool_result") {
                    send("tool_result", {
                      result: msg.result,
                      tool: msg.tool,
                    });
                  } else if (msg.type === "agent_paused") {
                    send("agent_paused", { pausedAt: msg.pausedAt });
                  } else if (msg.type === "agent_resumed") {
                    send("agent_resumed", {});
                  } else {
                    send(msg.type ?? "unknown", msg);
                  }
                } catch {
                  // Ignore unparseable messages
                }
              });

              ws.addEventListener("close", () => {
                send("disconnected", { reason: "agent_disconnected" });
                controller.close();
              });

              ws.addEventListener("error", () => {
                send("error", { message: "WebSocket connection failed" });
                controller.close();
              });
            } catch {
              send("error", { message: "Failed to connect to agent" });
              controller.close();
            }
          },
        }),
        {
          headers: {
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Content-Type": "text/event-stream",
          },
        }
      );
    },
    {
      params: t.Object({ id: t.String(), tid: t.String() }),
    }
  )

  // ── Inject a human message into a thread ──────────────────────
  .post(
    "/:id/threads/:tid/inject",
    async ({ params, body, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const row = await withUser(user.id, (tx) => findAgent(tx, params.id));
      if (!row) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      if (row.status !== "live" || !row.deploymentUrl) {
        set.status = 400;
        return { error: "Agent is not deployed" };
      }

      try {
        const res = await fetch(`${row.deploymentUrl}/api/interrupt`, {
          body: JSON.stringify({
            message: body.message,
            source: "crabfold-dashboard",
            threadId: params.tid,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          set.status = 502;
          return {
            detail: errData,
            error: "Agent rejected inject",
          };
        }

        const data = (await res.json()) as {
          injected?: boolean;
          messageId?: string;
        };

        return {
          injected: data.injected ?? true,
          messageId: data.messageId ?? null,
        };
      } catch {
        set.status = 502;
        return { error: "Failed to reach agent" };
      }
    },
    {
      body: t.Object({
        message: t.String({ minLength: 1 }),
      }),
      params: t.Object({ id: t.String(), tid: t.String() }),
    }
  )

  // ── Pause / Resume agent ──────────────────────────────────────
  .post(
    "/:id/control",
    async ({ params, body, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const row = await withUser(user.id, (tx) => findAgent(tx, params.id));
      if (!row) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      if (row.status !== "live" || !row.deploymentUrl) {
        set.status = 400;
        return { error: "Agent is not deployed" };
      }

      try {
        const res = await fetch(`${row.deploymentUrl}/api/control`, {
          body: JSON.stringify({ action: body.action }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          set.status = 502;
          return {
            detail: errData,
            error: "Agent rejected control command",
          };
        }

        const data = (await res.json()) as {
          status?: string;
          pausedAt?: string;
        };

        return {
          action: body.action,
          pausedAt: data.pausedAt ?? null,
          status:
            data.status ?? (body.action === "pause" ? "paused" : "running"),
        };
      } catch {
        set.status = 502;
        return { error: "Failed to reach agent" };
      }
    },
    {
      body: t.Object({
        action: t.Union([t.Literal("pause"), t.Literal("resume")]),
      }),
      params: t.Object({ id: t.String() }),
    }
  );
