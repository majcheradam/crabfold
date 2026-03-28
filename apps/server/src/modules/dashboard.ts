import { auth } from "@crabfold/auth";
import { db, eq } from "@crabfold/db";
import { agent } from "@crabfold/db/schema/agent";
import { Elysia, t } from "elysia";

import { checkAgentHealth } from "../lib/health-check";
import type { AgentHealth, HealthStatus } from "../lib/health-check";

export type { AgentHealth, HealthStatus } from "../lib/health-check";

export interface DashboardAgent {
  id: string;
  slug: string;
  name: string;
  fork: string;
  status: string;
  health: HealthStatus | null;
  threadCount: number;
  lastActive: string;
}

async function getAuthedUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return null;
  }
  return session.user;
}

export const dashboardModule = new Elysia({ prefix: "/api" })
  // ── List agents for a user with health status ─────────────────
  .get(
    "/agents",
    async ({ query, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { userId } = query;

      // Users can only list their own agents
      if (userId !== user.id) {
        set.status = 403;
        return { error: "Forbidden" };
      }

      const rows = await db
        .select()
        .from(agent)
        .where(eq(agent.userId, userId));

      // Health check all live agents in parallel
      const healthChecks = new Map<string, Promise<AgentHealth>>();
      for (const row of rows) {
        if (row.status === "live" && row.deploymentUrl) {
          healthChecks.set(row.id, checkAgentHealth(row.deploymentUrl));
        }
      }

      // Await all health checks
      const healthResults = new Map<string, AgentHealth>();
      for (const [id, promise] of healthChecks) {
        healthResults.set(id, await promise);
      }

      const agents: DashboardAgent[] = rows.map((row) => {
        const health = healthResults.get(row.id);
        return {
          fork: row.fork,
          health: health?.status ?? null,
          id: row.id,
          lastActive: row.updatedAt.toISOString(),
          name: row.name,
          slug: row.slug,
          status: row.status,
          threadCount: health?.activeThreads ?? 0,
        };
      });

      return { agents };
    },
    {
      query: t.Object({
        userId: t.String(),
      }),
    }
  )

  // ── Health check all deployed agents (status poller) ──────────
  .get("/agents/status", async ({ request, set }) => {
    const user = await getAuthedUser(request.headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const rows = await db.select().from(agent).where(eq(agent.userId, user.id));

    const liveAgents = rows.filter(
      (r) => r.status === "live" && r.deploymentUrl
    );

    // Health check all live agents in parallel
    const checks = await Promise.all(
      liveAgents.map(async (row) => {
        const health = await checkAgentHealth(row.deploymentUrl ?? "");
        return [row.id, health.status] as const;
      })
    );

    const statuses: Record<string, HealthStatus> = {};
    for (const [id, status] of checks) {
      statuses[id] = status;
    }

    return { statuses };
  });
