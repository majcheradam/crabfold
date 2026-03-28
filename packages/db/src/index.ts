import { env } from "@crabfold/env/server";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export { and, eq, sql } from "drizzle-orm";

export function createDb() {
  return drizzle(env.DATABASE_URL, { schema });
}

export const db = createDb();

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Execute a callback within a transaction scoped to a specific user.
 * Sets `app.user_id` via SET LOCAL so PostgreSQL RLS policies
 * restrict all queries to that user's rows.
 */
export async function withUser<T>(
  userId: string,
  fn: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql.raw(`SET LOCAL app.user_id = '${userId.replaceAll("'", "''")}'`)
    );
    return fn(tx);
  });
}
