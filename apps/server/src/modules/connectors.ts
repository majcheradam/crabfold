import { auth } from "@crabfold/auth";
import { and, eq, withUser } from "@crabfold/db";
import { agent } from "@crabfold/db/schema/agent";
import { agentSkill } from "@crabfold/db/schema/agent-skill";
import { mcpConnection } from "@crabfold/db/schema/mcp-connection";
import { env } from "@crabfold/env/server";
import { randomUUIDv7 } from "bun";
import { Elysia, t } from "elysia";

async function getAuthedUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return null;
  }
  return session.user;
}

interface ClawhubSkill {
  slug: string;
  displayName: string;
  summary: string | null;
  author?: string;
  downloads?: number;
  version?: string;
}

interface ClawhubSkillPackage {
  manifest: Record<string, unknown>;
  files: { path: string; content: string }[];
}

export const connectorsModule = new Elysia({ prefix: "/api/connectors" })
  // ── Search skills from Clawhub ──────────────────────────────
  .get(
    "/skills",
    async ({ query, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { q, category } = query;

      // Search Clawhub API
      const params = new URLSearchParams();
      if (q) {
        params.set("q", q);
      }
      if (category) {
        params.set("category", category);
      }

      let clawhubSkills: ClawhubSkill[] = [];
      try {
        const res = await fetch(
          `${env.CLAWHUB_API_URL}/api/v1/search?${params.toString()}`
        );
        if (res.ok) {
          const data = (await res.json()) as { results: ClawhubSkill[] };
          clawhubSkills = data.results;
        }
      } catch {
        // Clawhub unavailable, return empty
      }

      // Get user's installed skills to merge install status
      const installedSkills = await withUser(user.id, (tx) =>
        tx.select().from(agentSkill)
      );

      const installedMap = new Map<string, string[]>();
      for (const s of installedSkills) {
        const agents = installedMap.get(s.skillId) ?? [];
        agents.push(s.agentId);
        installedMap.set(s.skillId, agents);
      }

      const skills = clawhubSkills.map((s) => ({
        ...s,
        enabledOn: installedMap.get(s.slug) ?? [],
        installed: installedMap.has(s.slug),
      }));

      return { skills };
    },
    {
      detail: {
        description: "Search the Clawhub skill marketplace",
        tags: ["Connectors"],
      },
      query: t.Object({
        category: t.Optional(t.String()),
        q: t.Optional(t.String()),
      }),
    }
  )

  // ── List installed skills for an agent ──────────────────────
  .get(
    "/skills/:agentId",
    async ({ params, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      // Verify agent ownership
      const agentRow = await withUser(user.id, (tx) =>
        tx
          .select()
          .from(agent)
          .where(eq(agent.id, params.agentId))
          .then((rows) => rows[0] ?? null)
      );

      if (!agentRow) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      const skills = await withUser(user.id, (tx) =>
        tx
          .select()
          .from(agentSkill)
          .where(eq(agentSkill.agentId, params.agentId))
      );

      return { skills };
    },
    {
      detail: {
        description: "List installed skills for an agent",
        tags: ["Connectors"],
      },
      params: t.Object({ agentId: t.String() }),
    }
  )

  // ── Install a skill on an agent ─────────────────────────────
  .post(
    "/install",
    async ({ body, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { agentId, skillId } = body;

      // Verify agent ownership
      const agentRow = await withUser(user.id, (tx) =>
        tx
          .select()
          .from(agent)
          .where(eq(agent.id, agentId))
          .then((rows) => rows[0] ?? null)
      );

      if (!agentRow) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      // Check not already installed
      const existing = await withUser(user.id, (tx) =>
        tx
          .select()
          .from(agentSkill)
          .where(
            and(
              eq(agentSkill.agentId, agentId),
              eq(agentSkill.skillId, skillId)
            )
          )
      );

      if (existing.length > 0) {
        return {
          installed: true,
          message: "Skill already installed",
          tools: [],
        };
      }

      // Download skill package from Clawhub
      let skillPackage: ClawhubSkillPackage | null = null;
      try {
        const res = await fetch(
          `${env.CLAWHUB_API_URL}/api/v1/skills/${encodeURIComponent(skillId)}/download`
        );
        if (res.ok) {
          skillPackage = (await res.json()) as ClawhubSkillPackage;
        }
      } catch {
        // Clawhub unavailable — proceed without package
      }

      // Insert skill record
      const id = randomUUIDv7();
      await withUser(user.id, (tx) =>
        tx.insert(agentSkill).values({
          agentId,
          id,
          skillId,
          userId: user.id,
        })
      );

      // Add skill to agent's skills array
      const updatedSkills = [...new Set([...agentRow.skills, skillId])];
      await withUser(user.id, (tx) =>
        tx
          .update(agent)
          .set({ skills: updatedSkills })
          .where(eq(agent.id, agentId))
      );

      // If agent is live, install on the running agent
      let tools: string[] = [];
      if (agentRow.status === "live" && agentRow.deploymentUrl) {
        try {
          const res = await fetch(
            `${agentRow.deploymentUrl}/api/skills/install`,
            {
              body: JSON.stringify({
                files: skillPackage?.files,
                skillId,
              }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
            }
          );
          if (res.ok) {
            const data = (await res.json()) as { tools?: string[] };
            tools = data.tools ?? [];
          }
        } catch {
          // Agent unreachable, skill will load on next restart
        }
      }

      return { installed: true, tools };
    },
    {
      body: t.Object({
        agentId: t.String(),
        skillId: t.String(),
      }),
      detail: {
        description:
          "Install a skill from Clawhub onto an agent. Downloads the package and forwards to the running agent.",
        tags: ["Connectors"],
      },
    }
  )

  // ── Uninstall a skill from an agent ─────────────────────────
  .delete(
    "/uninstall",
    async ({ body, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { agentId, skillId } = body;

      // Verify agent ownership
      const agentRow = await withUser(user.id, (tx) =>
        tx
          .select()
          .from(agent)
          .where(eq(agent.id, agentId))
          .then((rows) => rows[0] ?? null)
      );

      if (!agentRow) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      // Delete skill record
      await withUser(user.id, (tx) =>
        tx
          .delete(agentSkill)
          .where(
            and(
              eq(agentSkill.agentId, agentId),
              eq(agentSkill.skillId, skillId)
            )
          )
      );

      // Remove skill from agent's skills array
      const updatedSkills = agentRow.skills.filter((s) => s !== skillId);
      await withUser(user.id, (tx) =>
        tx
          .update(agent)
          .set({ skills: updatedSkills })
          .where(eq(agent.id, agentId))
      );

      // If agent is live, uninstall on the running agent
      if (agentRow.status === "live" && agentRow.deploymentUrl) {
        try {
          await fetch(`${agentRow.deploymentUrl}/api/skills/uninstall`, {
            body: JSON.stringify({ skillId }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
        } catch {
          // Agent unreachable
        }
      }

      return { uninstalled: true };
    },
    {
      body: t.Object({
        agentId: t.String(),
        skillId: t.String(),
      }),
      detail: {
        description: "Uninstall a skill from an agent",
        tags: ["Connectors"],
      },
    }
  )

  // ── List MCP connections for an agent ───────────────────────
  .get(
    "/mcp/:agentId",
    async ({ params, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      // Verify agent ownership
      const agentRow = await withUser(user.id, (tx) =>
        tx
          .select()
          .from(agent)
          .where(eq(agent.id, params.agentId))
          .then((rows) => rows[0] ?? null)
      );

      if (!agentRow) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      const connections = await withUser(user.id, (tx) =>
        tx
          .select()
          .from(mcpConnection)
          .where(eq(mcpConnection.agentId, params.agentId))
      );

      return {
        connections: connections.map((c) => ({
          connectedAt: c.connectedAt,
          id: c.id,
          name: c.name,
          status: "connected" as const,
          tools: c.tools,
          url: c.url,
        })),
      };
    },
    {
      detail: {
        description: "List MCP server connections for an agent",
        tags: ["Connectors"],
      },
      params: t.Object({ agentId: t.String() }),
    }
  )

  // ── Connect MCP server to an agent ──────────────────────────
  .post(
    "/mcp",
    async ({ body, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { agentId, url, name } = body;

      // Verify agent ownership
      const agentRow = await withUser(user.id, (tx) =>
        tx
          .select()
          .from(agent)
          .where(eq(agent.id, agentId))
          .then((rows) => rows[0] ?? null)
      );

      if (!agentRow) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      // Validate MCP server URL (health check)
      try {
        const healthRes = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        if (!healthRes.ok) {
          set.status = 422;
          return { error: "MCP server health check failed" };
        }
      } catch {
        set.status = 422;
        return { error: "MCP server unreachable" };
      }

      // Save MCP connection
      const id = randomUUIDv7();
      let tools: string[] = [];

      // If agent is live, connect MCP on the running agent
      if (agentRow.status === "live" && agentRow.deploymentUrl) {
        try {
          const res = await fetch(`${agentRow.deploymentUrl}/api/mcp/connect`, {
            body: JSON.stringify({ name, url }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          if (res.ok) {
            const data = (await res.json()) as { tools?: string[] };
            tools = data.tools ?? [];
          }
        } catch {
          // Agent unreachable, will connect on next restart
        }
      }

      await withUser(user.id, (tx) =>
        tx.insert(mcpConnection).values({
          agentId,
          id,
          name,
          tools,
          url,
          userId: user.id,
        })
      );

      return {
        mcp: {
          id,
          name,
          status: "connected" as const,
          tools,
        },
      };
    },
    {
      body: t.Object({
        agentId: t.String(),
        name: t.String({ minLength: 1 }),
        url: t.String({ minLength: 1 }),
      }),
      detail: {
        description:
          "Connect an MCP server to an agent. Validates the server, discovers tools, and persists the connection.",
        tags: ["Connectors"],
      },
    }
  )

  // ── Disconnect MCP server from an agent ─────────────────────
  .delete(
    "/mcp",
    async ({ body, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { agentId, connectionId } = body;

      // Verify agent ownership
      const agentRow = await withUser(user.id, (tx) =>
        tx
          .select()
          .from(agent)
          .where(eq(agent.id, agentId))
          .then((rows) => rows[0] ?? null)
      );

      if (!agentRow) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      // Find and delete the connection
      const [deleted] = await withUser(user.id, (tx) =>
        tx
          .delete(mcpConnection)
          .where(
            and(
              eq(mcpConnection.id, connectionId),
              eq(mcpConnection.agentId, agentId)
            )
          )
          .returning({ id: mcpConnection.id, name: mcpConnection.name })
      );

      if (!deleted) {
        set.status = 404;
        return { error: "MCP connection not found" };
      }

      // If agent is live, disconnect on the running agent
      if (agentRow.status === "live" && agentRow.deploymentUrl) {
        try {
          await fetch(`${agentRow.deploymentUrl}/api/mcp/disconnect`, {
            body: JSON.stringify({ name: deleted.name }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
        } catch {
          // Agent unreachable
        }
      }

      return { disconnected: true };
    },
    {
      body: t.Object({
        agentId: t.String(),
        connectionId: t.String(),
      }),
      detail: {
        description: "Disconnect an MCP server from an agent",
        tags: ["Connectors"],
      },
    }
  );
