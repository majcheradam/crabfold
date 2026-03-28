import { auth } from "@crabfold/auth";
import { and, eq, withUser } from "@crabfold/db";
import { agent } from "@crabfold/db/schema/agent";
import { apiKey } from "@crabfold/db/schema/api-key";
import { randomUUIDv7 } from "bun";
import { Elysia, t } from "elysia";

import { generateApiKey, hashApiKey } from "../lib/api-key";

async function getAuthedUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return null;
  }
  return session.user;
}

export const apiKeysModule = new Elysia({ prefix: "/api/agents" })
  // ── Create API key for an agent ────────────────────────────────
  .post(
    "/:id/keys",
    async ({ params, body, request, set }) => {
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
          .where(eq(agent.id, params.id))
          .then((rows) => rows[0] ?? null)
      );

      if (!agentRow) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      const rawKey = generateApiKey();
      const keyHash = hashApiKey(rawKey);
      const keyPrefix = `${rawKey.slice(0, 7)}...`;
      const id = randomUUIDv7();

      await withUser(user.id, (tx) =>
        tx.insert(apiKey).values({
          agentId: params.id,
          id,
          keyHash,
          keyPrefix,
          label: body.label,
          rateLimit: body.rateLimit ?? 60,
          userId: user.id,
        })
      );

      // Return the raw key only once — it cannot be retrieved again
      return {
        id,
        key: rawKey,
        keyPrefix,
        label: body.label,
        rateLimit: body.rateLimit ?? 60,
      };
    },
    {
      body: t.Object({
        label: t.String({ minLength: 1 }),
        rateLimit: t.Optional(t.Number({ maximum: 10_000, minimum: 1 })),
      }),
      params: t.Object({ id: t.String() }),
    }
  )

  // ── List API keys for an agent ─────────────────────────────────
  .get(
    "/:id/keys",
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
          .where(eq(agent.id, params.id))
          .then((rows) => rows[0] ?? null)
      );

      if (!agentRow) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      const keys = await withUser(user.id, (tx) =>
        tx
          .select({
            createdAt: apiKey.createdAt,
            id: apiKey.id,
            keyPrefix: apiKey.keyPrefix,
            label: apiKey.label,
            lastUsedAt: apiKey.lastUsedAt,
            rateLimit: apiKey.rateLimit,
            revokedAt: apiKey.revokedAt,
          })
          .from(apiKey)
          .where(eq(apiKey.agentId, params.id))
      );

      return { keys };
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )

  // ── Revoke an API key ──────────────────────────────────────────
  .delete(
    "/:id/keys/:keyId",
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
          .where(eq(agent.id, params.id))
          .then((rows) => rows[0] ?? null)
      );

      if (!agentRow) {
        set.status = 404;
        return { error: "Agent not found" };
      }

      const [updated] = await withUser(user.id, (tx) =>
        tx
          .update(apiKey)
          .set({ revokedAt: new Date() })
          .where(
            and(eq(apiKey.id, params.keyId), eq(apiKey.agentId, params.id))
          )
          .returning({ id: apiKey.id })
      );

      if (!updated) {
        set.status = 404;
        return { error: "API key not found" };
      }

      return { revoked: true };
    },
    {
      params: t.Object({ id: t.String(), keyId: t.String() }),
    }
  );
