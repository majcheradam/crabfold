import { auth } from "@crabfold/auth";
import { eq, withUser } from "@crabfold/db";
import { agent } from "@crabfold/db/schema/agent";
import { Elysia, t } from "elysia";

async function getAuthedUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return null;
  }
  return session.user;
}

/**
 * Parse a range string like "24h", "7d", "1h" into milliseconds.
 */
function parseRange(range: string): number {
  const match = range.match(/^(\d+)(h|d|m)$/);
  if (!match) {
    // default 24h
    return 24 * 60 * 60 * 1000;
  }

  const value = Number(match[1]);
  switch (match[2]) {
    case "h": {
      return value * 60 * 60 * 1000;
    }
    case "d": {
      return value * 24 * 60 * 60 * 1000;
    }
    case "m": {
      return value * 60 * 1000;
    }
    default: {
      return 24 * 60 * 60 * 1000;
    }
  }
}

// ── OTel query types ────────────────────────────────────────────

export interface AgentMetrics {
  agentId: string;
  range: string;
  totalTokens: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  costUsd: number;
  errorCount: number;
  successRate: number;
  totalRequests: number;
}

export interface TraceEntry {
  traceId: string;
  name: string;
  durationMs: number;
  status: "ok" | "error";
  tokenCount: number;
  timestamp: string;
}

export interface SpanNode {
  spanId: string;
  parentSpanId: string | null;
  name: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  attributes: Record<string, string | number>;
  children: SpanNode[];
}

export interface TraceSpanTree {
  traceId: string;
  rootSpan: SpanNode;
  totalDuration: number;
  totalTokens: number;
}

export interface LiveMetricUpdate {
  type: string;
  agentId?: string;
  tokens?: number;
  costUsd?: number;
  latencyMs?: number;
  timestamp?: string;
}

// ── OTel query helpers ──────────────────────────────────────────
// In production, these would query an OTel collector / Tempo / ClickHouse.

function queryAgentMetrics(agentId: string, _since: Date): AgentMetrics {
  // Stub: replace with actual OTel collector query
  // e.g., query Tempo: GET /api/search?tags=agent.id=${agentId}&start=${since}
  return {
    agentId,
    avgLatencyMs: 0,
    costUsd: 0,
    errorCount: 0,
    p99LatencyMs: 0,
    range: "24h",
    successRate: 1,
    totalRequests: 0,
    totalTokens: 0,
  };
}

function queryAgentTraces(
  _agentId: string,
  _limit: number,
  _sort: string
): TraceEntry[] {
  // Stub: replace with actual OTel collector query
  return [];
}

function queryTraceSpanTree(_traceId: string): TraceSpanTree | null {
  // Stub: replace with actual OTel collector query
  return null;
}

function queryLiveMetricUpdate(agentId: string): LiveMetricUpdate {
  // Stub: replace with actual OTel collector query
  return {
    agentId,
    costUsd: 0,
    latencyMs: 0,
    timestamp: new Date().toISOString(),
    tokens: 0,
    type: "metric_update",
  };
}

/**
 * Observability module — aggregated metrics and traces from OTel.
 */
export const observabilityModule = new Elysia({ prefix: "/api/agents" })
  // ── Aggregated metrics ──────────────────────────────────────
  .get(
    "/:id/metrics",
    async ({ params, query, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const agentRow = await withUser(user.id, (tx) =>
        tx
          .select()
          .from(agent)
          .where(eq(agent.id, params.id))
          .then((rows) => rows[0] ?? null)
      );

      if (!agentRow) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      const rangeMs = parseRange(query.range ?? "24h");
      const since = new Date(Date.now() - rangeMs);

      const metrics = queryAgentMetrics(params.id, since);
      return metrics;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        range: t.Optional(t.String()),
      }),
    }
  )

  // ── Recent traces ───────────────────────────────────────────
  .get(
    "/:id/traces",
    async ({ params, query, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const agentRow = await withUser(user.id, (tx) =>
        tx
          .select()
          .from(agent)
          .where(eq(agent.id, params.id))
          .then((rows) => rows[0] ?? null)
      );

      if (!agentRow) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      const limit = Number(query.limit ?? "20");
      const sort = query.sort ?? "recent";

      const traces = queryAgentTraces(params.id, limit, sort);
      return { traces };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        limit: t.Optional(t.String()),
        sort: t.Optional(t.String()),
      }),
    }
  )

  // ── Full span tree for a trace ──────────────────────────────
  .get(
    "/:id/traces/:traceId",
    async ({ params, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const agentRow = await withUser(user.id, (tx) =>
        tx
          .select()
          .from(agent)
          .where(eq(agent.id, params.id))
          .then((rows) => rows[0] ?? null)
      );

      if (!agentRow) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      const trace = queryTraceSpanTree(params.traceId);
      if (!trace) {
        set.status = 404;
        return { error: "Trace not found" };
      }

      return trace;
    },
    {
      params: t.Object({ id: t.String(), traceId: t.String() }),
    }
  )

  // ── Real-time metric updates (SSE) ─────────────────────────
  .get(
    "/:id/metrics/live",
    async ({ params, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const agentRow = await withUser(user.id, (tx) =>
        tx
          .select()
          .from(agent)
          .where(eq(agent.id, params.id))
          .then((rows) => rows[0] ?? null)
      );

      if (!agentRow) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            let closed = false;

            const send = (data: unknown) => {
              if (closed) {
                return;
              }
              try {
                controller.enqueue(
                  encoder.encode(
                    `event: metric_update\ndata: ${JSON.stringify(data)}\n\n`
                  )
                );
              } catch {
                closed = true;
              }
            };

            // Poll OTel for new spans every 5 seconds
            const interval = setInterval(() => {
              if (closed) {
                clearInterval(interval);
                return;
              }
              try {
                const update = queryLiveMetricUpdate(params.id);
                send(update);
              } catch {
                // OTel query failed, skip this tick
              }
            }, 5000);

            // Send initial heartbeat
            send({ agentId: params.id, type: "connected" });

            // Clean up on abort
            request.signal?.addEventListener("abort", () => {
              closed = true;
              clearInterval(interval);
              try {
                controller.close();
              } catch {
                // already closed
              }
            });
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
      params: t.Object({ id: t.String() }),
    }
  );
