import { createDb } from "@crabfold/db";
import * as schema from "@crabfold/db/schema/auth";
import { env } from "@crabfold/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [nextCookies()],
    secret: env.BETTER_AUTH_SECRET,
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
      railway: {
        clientId: env.RAILWAY_CLIENT_ID,
        clientSecret: env.RAILWAY_CLIENT_SECRET,
        prompt: "consent",
        scope: ["offline_access"],
      },
    },
    trustedOrigins: [env.CORS_ORIGIN],
  });
}

export const auth = createAuth();
