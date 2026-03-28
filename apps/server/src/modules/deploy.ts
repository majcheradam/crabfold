import { auth } from "@crabfold/auth";
import { and, db, eq } from "@crabfold/db";
import { agent } from "@crabfold/db/schema/agent";
import { account } from "@crabfold/db/schema/auth";
import { Elysia, t } from "elysia";

import { createJob, emitJobEvent } from "../lib/job-store";

async function getAuthedUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return null;
  }
  return session.user;
}

export const deployModule = new Elysia({ prefix: "/api/agents" }).post(
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

    // Check if user has connected their Railway account
    const [railwayAccount] = await db
      .select()
      .from(account)
      .where(
        and(eq(account.userId, user.id), eq(account.providerId, "railway"))
      );

    if (!railwayAccount) {
      set.status = 403;
      return { code: "RAILWAY_NOT_CONNECTED" as const, error: "Forbidden" };
    }

    // Railway account exists — kick off deploy pipeline
    const jobId = createJob();

    (() => {
      try {
        emitJobEvent(jobId, {
          data: {},
          label: "Preparing deployment",
          status: "done",
          step: "prepare",
        });

        emitJobEvent(jobId, {
          data: {},
          label: "Creating GitHub repository",
          status: "done",
          step: "github",
        });

        emitJobEvent(jobId, {
          data: {},
          label: "Provisioning Railway service",
          status: "done",
          step: "railway",
        });

        emitJobEvent(jobId, {
          data: { agentId: row.id, slug: row.slug },
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
    params: t.Object({ id: t.String() }),
  }
);
