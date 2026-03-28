import { db, eq } from "@crabfold/db";
import { agent } from "@crabfold/db/schema/agent";
import { apiKey } from "@crabfold/db/schema/api-key";

/**
 * Hash an API key using SHA-256 for storage.
 */
export function hashApiKey(key: string): string {
  const hash = new Bun.CryptoHasher("sha256");
  hash.update(key);
  return hash.digest("hex");
}

/**
 * Generate a new API key string with a `cb_` prefix.
 */
export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `cb_${hex}`;
}

async function updateLastUsed(keyId: string) {
  try {
    await db
      .update(apiKey)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKey.id, keyId))
      .execute();
  } catch {
    // fire-and-forget: swallow errors
  }
}

/**
 * Validate an API key from a request.
 * Returns the api_key row + agent row if valid, null otherwise.
 * Uses raw db (no RLS) since gateway callers are external.
 */
export async function validateApiKey(key: string) {
  const keyHash = hashApiKey(key);

  const [row] = await db
    .select({
      agentDeploymentUrl: agent.deploymentUrl,
      agentId: apiKey.agentId,
      agentStatus: agent.status,
      keyId: apiKey.id,
      rateLimit: apiKey.rateLimit,
      revokedAt: apiKey.revokedAt,
      userId: apiKey.userId,
    })
    .from(apiKey)
    .innerJoin(agent, eq(apiKey.agentId, agent.id))
    .where(eq(apiKey.keyHash, keyHash));

  if (!row) {
    return null;
  }

  if (row.revokedAt) {
    return null;
  }

  // Update last_used_at (fire-and-forget)
  updateLastUsed(row.keyId);

  return row;
}
