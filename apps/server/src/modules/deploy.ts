import { auth } from "@crabfold/auth";
import { and, db, eq } from "@crabfold/db";
import { agent } from "@crabfold/db/schema/agent";
import { account } from "@crabfold/db/schema/auth";
import { createDefaultDeps, deployToRailway } from "@crabfold/deploy";
import type { DeploySSEEvent } from "@crabfold/deploy";
import { Elysia, t } from "elysia";

import type { JobEvent } from "../lib/job-store";
import { createJob, emitJobEvent } from "../lib/job-store";

async function getAuthedUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return null;
  }
  return session.user;
}

async function getOAuthToken(
  userId: string,
  providerId: string
): Promise<string | null> {
  const [row] = await db
    .select({ accessToken: account.accessToken })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, providerId)));
  return row?.accessToken ?? null;
}

const STEP_LABELS: Record<string, string> = {
  deploying: "Deploying",
  env_vars: "Setting environment variables",
  prepare: "Preparing deployment",
  project: "Creating Railway project",
  repo: "Creating GitHub repository",
  service: "Creating Railway service",
  storage: "Provisioning storage",
};

function sseFromDeployEvent(event: DeploySSEEvent): JobEvent {
  if ("event" in event && event.event === "complete") {
    return {
      data: { railwayProjectId: event.railwayProjectId, url: event.url },
      event: "complete",
    };
  }
  if ("event" in event && event.event === "error") {
    return {
      data: { message: event.message },
      event: "error",
    };
  }
  const label =
    event.message ??
    (event.status === "done"
      ? (STEP_LABELS[event.step] ?? event.step)
      : `${STEP_LABELS[event.step] ?? event.step}...`);
  return {
    data: { buildStatus: event.buildStatus, domain: event.domain },
    label,
    status: event.status as JobEvent["status"],
    step: event.step,
  };
}

export const deployModule = new Elysia({ prefix: "/api/agents" })
  .get(
    "/:id/deploy",
    async ({ params, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const [row] = await db
        .select({ id: agent.id })
        .from(agent)
        .where(and(eq(agent.id, params.id), eq(agent.userId, user.id)));

      if (!row) {
        set.status = 404;
        return { error: "Not found" };
      }

      const [githubToken, railwayToken] = await Promise.all([
        getOAuthToken(user.id, "github"),
        getOAuthToken(user.id, "railway"),
      ]);

      return {
        github: !!githubToken,
        railway: !!railwayToken,
      };
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )
  .post(
    "/:id/deploy",
    async ({ params, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      // Verify the agent exists and belongs to this user
      const [row] = await db
        .select()
        .from(agent)
        .where(and(eq(agent.id, params.id), eq(agent.userId, user.id)));

      if (!row) {
        set.status = 404;
        return { error: "Not found" };
      }

      // Retrieve OAuth tokens
      const [githubToken, railwayToken] = await Promise.all([
        getOAuthToken(user.id, "github"),
        getOAuthToken(user.id, "railway"),
      ]);

      if (!railwayToken) {
        set.status = 403;
        return { code: "RAILWAY_NOT_CONNECTED" as const, error: "Forbidden" };
      }

      if (!githubToken) {
        set.status = 403;
        return { code: "GITHUB_NOT_CONNECTED" as const, error: "Forbidden" };
      }

      const jobId = createJob();

      // Run real deploy pipeline in background
      (async () => {
        const deps = await createDefaultDeps();

        await deployToRailway(
          {
            agentId: row.id,
            agentName: row.name,
            agentSlug: row.slug,
            envVars: {},
            files: row.files,
            fork: row.fork,
            skills: row.skills,
          },
          { githubToken, railwayToken },
          (event) => emitJobEvent(jobId, sseFromDeployEvent(event)),
          deps
        );
      })();

      return { jobId };
    },
    {
      params: t.Object({ id: t.String() }),
    }
  );
