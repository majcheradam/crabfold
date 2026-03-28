import { auth } from "@crabfold/auth";
import { db } from "@crabfold/db";
import { agent } from "@crabfold/db/schema/agent";
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

export const agentsModule = new Elysia({ prefix: "/api/agents" }).post(
  "/create",
  async ({ body, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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

        await db.insert(agent).values({
          config,
          files,
          fork: config.fork as "openclaw" | "nanobot" | "ironclaw",
          id,
          name: prompt.slice(0, 100),
          skills: config.skills,
          slug,
          soul,
          status: "draft",
          userId: session.user.id,
        });

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
);
