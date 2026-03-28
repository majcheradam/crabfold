import { auth } from "@crabfold/auth";
import { eq, withUser } from "@crabfold/db";
import type { DbTransaction } from "@crabfold/db";
import { agent } from "@crabfold/db/schema/agent";
import type { AgentConfig } from "@crabfold/db/schema/agent";
import { randomUUIDv7 } from "bun";
import { Elysia, t } from "elysia";

import { generateFiles } from "../lib/fork-adapters";
import { createJob, emitJobEvent } from "../lib/job-store";
import { runScaffold } from "../lib/scaffold";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 48);
}

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

export const agentsModule = new Elysia({ prefix: "/api/agents" })
  // ── Create agent (scaffold) ───────────────────────────────────
  .post(
    "/create",
    async ({ body, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const jobId = createJob();
      const { prompt } = body;

      // Run scaffold pipeline in background
      (async () => {
        try {
          const { config, soul } = await runScaffold(jobId, prompt);
          const files = generateFiles(config, soul);

          emitJobEvent(jobId, {
            data: { count: files.length },
            label: `${files.length} files generated`,
            status: "done",
            step: "files",
          });

          const slug = slugify(prompt.slice(0, 48));
          const id = randomUUIDv7();

          await withUser(user.id, (tx) =>
            tx.insert(agent).values({
              config,
              files,
              fork: config.fork as "openclaw" | "nanobot" | "ironclaw",
              id,
              name: prompt.slice(0, 100),
              skills: config.skills,
              slug,
              soul,
              status: "draft",
              userId: user.id,
            })
          );

          emitJobEvent(jobId, {
            data: { agentId: id, slug },
            event: "complete",
          });
        } catch (error) {
          emitJobEvent(jobId, {
            data: {
              message: error instanceof Error ? error.message : "Unknown error",
            },
            event: "error",
          });
        }
      })();

      return { jobId };
    },
    {
      body: t.Object({
        prompt: t.String({ minLength: 1 }),
      }),
    }
  )

  // ── Get agent ─────────────────────────────────────────────────
  .get(
    "/:id",
    async ({ params, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const row = await withUser(user.id, (tx) => findAgent(tx, params.id));
      if (!row) {
        set.status = 404;
        return { error: "Not found" };
      }

      return row;
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )

  // ── Update agent (save soul, config) ──────────────────────────
  .patch(
    "/:id",
    async ({ params, body, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const row = await withUser(user.id, (tx) => findAgent(tx, params.id));
      if (!row) {
        set.status = 404;
        return { error: "Not found" };
      }

      const updates: Record<string, unknown> = {};

      if (body.soul !== undefined) {
        updates.soul = body.soul;
        const files = row.files.map((f) =>
          f.path === "SOUL.md" ? { ...f, content: body.soul ?? "" } : f
        );
        updates.files = files;
      }

      if (body.name !== undefined) {
        updates.name = body.name;
      }

      if (Object.keys(updates).length === 0) {
        return { ...row, saved: true };
      }

      const [updated] = (await withUser(user.id, (tx) =>
        tx.update(agent).set(updates).where(eq(agent.id, params.id)).returning()
      )) as [typeof row];

      // Hot-reload if agent is live
      if (updated.status === "live" && updated.deploymentUrl) {
        try {
          await fetch(`${updated.deploymentUrl}/api/config/reload`, {
            body: JSON.stringify({
              skills: updated.skills,
              soul: updated.soul,
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          return { ...updated, reloaded: true };
        } catch {
          return { ...updated, reloaded: false };
        }
      }

      return { ...updated, saved: true };
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 100 })),
        soul: t.Optional(t.String()),
      }),
      params: t.Object({ id: t.String() }),
    }
  )

  // ── Toggle skills ─────────────────────────────────────────────
  .patch(
    "/:id/skills",
    async ({ params, body, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const row = await withUser(user.id, (tx) => findAgent(tx, params.id));
      if (!row) {
        set.status = 404;
        return { error: "Not found" };
      }

      const currentSkills = new Set(row.skills);

      for (const skill of body.enable ?? []) {
        currentSkills.add(skill);
      }
      for (const skill of body.disable ?? []) {
        currentSkills.delete(skill);
      }

      const skills = [...currentSkills];

      const config: AgentConfig = { ...row.config, skills };
      const files = generateFiles(config, row.soul);

      const [updated] = (await withUser(user.id, (tx) =>
        tx
          .update(agent)
          .set({ config, files, skills })
          .where(eq(agent.id, params.id))
          .returning()
      )) as [typeof row];

      return { skills: updated.skills };
    },
    {
      body: t.Object({
        disable: t.Optional(t.Array(t.String())),
        enable: t.Optional(t.Array(t.String())),
      }),
      params: t.Object({ id: t.String() }),
    }
  )

  // ── Switch fork ───────────────────────────────────────────────
  .post(
    "/:id/fork",
    async ({ params, body, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const row = await withUser(user.id, (tx) => findAgent(tx, params.id));
      if (!row) {
        set.status = 404;
        return { error: "Not found" };
      }

      if (body.to === row.fork) {
        return { newFiles: row.files, warnings: [] as string[] };
      }

      const config: AgentConfig = { ...row.config, fork: body.to };
      const files = generateFiles(config, row.soul);

      const warnings: string[] = [];
      if (body.to === "ironclaw") {
        warnings.push(
          "Ironclaw needs Postgres \u2014 will provision on deploy"
        );
      }

      const [updated] = (await withUser(user.id, (tx) =>
        tx
          .update(agent)
          .set({
            config,
            files,
            fork: body.to,
          })
          .where(eq(agent.id, params.id))
          .returning()
      )) as [typeof row];

      return { newFiles: updated.files, warnings };
    },
    {
      body: t.Object({
        from: t.Union([
          t.Literal("openclaw"),
          t.Literal("nanobot"),
          t.Literal("ironclaw"),
        ]),
        to: t.Union([
          t.Literal("openclaw"),
          t.Literal("nanobot"),
          t.Literal("ironclaw"),
        ]),
      }),
      params: t.Object({ id: t.String() }),
    }
  );
