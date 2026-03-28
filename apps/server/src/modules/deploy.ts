import { auth } from "@crabfold/auth";
import { and, db, eq } from "@crabfold/db";
import { agent } from "@crabfold/db/schema/agent";
import { account } from "@crabfold/db/schema/auth";
import {
  createDefaultDeps,
  deployToRailway,
  getServiceDomains,
} from "@crabfold/deploy";
import type { DeploySSEEvent } from "@crabfold/deploy";
import { env } from "@crabfold/env/server";
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

async function refreshRailwayToken(
  userId: string,
  refreshToken: string
): Promise<string | null> {
  const res = await fetch("https://backboard.railway.com/oauth2/token", {
    body: new URLSearchParams({
      client_id: env.RAILWAY_CLIENT_ID,
      client_secret: env.RAILWAY_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[railway] token refresh failed (${res.status}):`, text);
    return null;
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const updates: Record<string, unknown> = {
    accessToken: data.access_token,
    accessTokenExpiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
  };
  if (data.refresh_token) {
    updates.refreshToken = data.refresh_token;
  }

  await db
    .update(account)
    .set(updates)
    .where(and(eq(account.userId, userId), eq(account.providerId, "railway")));

  return data.access_token;
}

async function getOAuthToken(
  userId: string,
  providerId: string
): Promise<string | null> {
  const [row] = await db
    .select({
      accessToken: account.accessToken,
      accessTokenExpiresAt: account.accessTokenExpiresAt,
      refreshToken: account.refreshToken,
    })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, providerId)));

  if (!row) {
    return null;
  }

  // For Railway: always refresh if we have a refresh token and the access token
  // is missing, has no recorded expiry, or is expired/expiring within 60s
  if (providerId === "railway" && row.refreshToken) {
    const expired =
      !row.accessToken ||
      !row.accessTokenExpiresAt ||
      row.accessTokenExpiresAt.getTime() < Date.now() + 60_000;

    if (expired) {
      return refreshRailwayToken(userId, row.refreshToken);
    }
  }

  if (!row.accessToken) {
    return null;
  }

  return row.accessToken;
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
  )
  .post(
    "/:id/refresh-url",
    async ({ params, request, set }) => {
      const user = await getAuthedUser(request.headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const [row] = await db
        .select()
        .from(agent)
        .where(and(eq(agent.id, params.id), eq(agent.userId, user.id)));

      if (!row) {
        set.status = 404;
        return { error: "Not found" };
      }

      if (!row.railwayProjectId) {
        set.status = 400;
        return { error: "Agent has no Railway project" };
      }

      const railwayToken = await getOAuthToken(user.id, "railway");
      if (!railwayToken) {
        set.status = 403;
        return { code: "RAILWAY_NOT_CONNECTED" as const, error: "Forbidden" };
      }

      const domains = await getServiceDomains(
        railwayToken,
        row.railwayProjectId
      );

      if (domains.length === 0) {
        set.status = 404;
        return { error: "No domains found on Railway project" };
      }

      const deploymentUrl = `https://${domains[0]?.domain}`;

      if (deploymentUrl !== row.deploymentUrl) {
        await db
          .update(agent)
          .set({ deploymentUrl })
          .where(eq(agent.id, params.id));
      }

      return { deploymentUrl, updated: deploymentUrl !== row.deploymentUrl };
    },
    {
      params: t.Object({ id: t.String() }),
    }
  );
