import { auth } from "@crabfold/auth";
import { and, db, eq } from "@crabfold/db";
import { agent } from "@crabfold/db/schema/agent";
import { Elysia, t } from "elysia";

async function getAuthedUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return null;
  }
  return session.user;
}

async function getDeployedAgent(userId: string, agentId: string) {
  const [row] = await db
    .select({
      config: agent.config,
      deploymentUrl: agent.deploymentUrl,
      id: agent.id,
      status: agent.status,
    })
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, userId)));
  return row ?? null;
}

/**
 * Proxy a request to the deployed openclaw gateway.
 * Returns parsed JSON or throws.
 */
async function proxyToGateway(
  deploymentUrl: string,
  path: string,
  method = "GET",
  body?: unknown
): Promise<unknown> {
  const url = `${deploymentUrl}${path}`;
  const options: RequestInit = {
    headers: { "Content-Type": "application/json" },
    method,
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway responded ${res.status}: ${text}`);
  }

  const contentType = res.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return { message: await res.text() };
}

export const channelsModule = new Elysia({ prefix: "/api/agents" })
  // ── Get channel status from deployed agent ──────────────────────
  .get(
    "/:id/channels",
    async ({ params, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const row = await getDeployedAgent(user.id, params.id);
      if (!row) {
        set.status = 404;
        return { error: "Not found" };
      }

      // Return configured channels from agent config
      const configured = row.config.channels ?? [];

      // If agent is live, try to get live status from gateway
      if (row.status === "live" && row.deploymentUrl) {
        try {
          const health = (await proxyToGateway(
            row.deploymentUrl,
            "/api/health"
          )) as Record<string, unknown>;

          return {
            channels: configured.map((ch) => ({
              ...ch,
              connected: Boolean(
                health.channels &&
                typeof health.channels === "object" &&
                (health.channels as Record<string, unknown>)[ch.id]
              ),
            })),
            gatewayStatus: "online",
          };
        } catch {
          return {
            channels: configured.map((ch) => ({
              ...ch,
              connected: false,
            })),
            gatewayStatus: "unreachable",
          };
        }
      }

      return {
        channels: configured.map((ch) => ({
          ...ch,
          connected: false,
        })),
        gatewayStatus: row.status === "live" ? "no_url" : "not_deployed",
      };
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )

  // ── Get QR code / pairing link for a channel ────────────────────
  .post(
    "/:id/channels/:channelId/connect",
    async ({ params, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const row = await getDeployedAgent(user.id, params.id);
      if (!row) {
        set.status = 404;
        return { error: "Not found" };
      }

      if (row.status !== "live" || !row.deploymentUrl) {
        set.status = 400;
        return { error: "Agent must be deployed before connecting channels" };
      }

      try {
        const result = await proxyToGateway(
          row.deploymentUrl,
          `/api/channels/${params.channelId}/connect`,
          "POST"
        );
        return result;
      } catch (error) {
        set.status = 502;
        return {
          error: "Failed to reach agent gateway",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ channelId: t.String(), id: t.String() }),
    }
  )

  // ── Disconnect a channel ────────────────────────────────────────
  .post(
    "/:id/channels/:channelId/disconnect",
    async ({ params, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const row = await getDeployedAgent(user.id, params.id);
      if (!row) {
        set.status = 404;
        return { error: "Not found" };
      }

      if (row.status !== "live" || !row.deploymentUrl) {
        set.status = 400;
        return { error: "Agent is not deployed" };
      }

      try {
        const result = await proxyToGateway(
          row.deploymentUrl,
          `/api/channels/${params.channelId}/disconnect`,
          "POST"
        );
        return result;
      } catch (error) {
        set.status = 502;
        return {
          error: "Failed to reach agent gateway",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ channelId: t.String(), id: t.String() }),
    }
  );
