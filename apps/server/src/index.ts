import { auth } from "@crabfold/auth";
import { env } from "@crabfold/env/server";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";

import { agentsModule } from "./modules/agents";
import { jobsModule } from "./modules/jobs";

const betterAuth = new Elysia({ name: "better-auth" })
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });
        if (!session) {
          return status(401);
        }
        return { session: session.session, user: session.user };
      },
    },
  });

const app = new Elysia()
  .use(openapi())
  .use(
    cors({
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      origin: env.CORS_ORIGIN,
    })
  )
  .use(betterAuth)
  .use(agentsModule)
  .use(jobsModule)
  .get("/", () => "OK", { detail: { hide: true } })
  .listen(3000);

export type App = typeof app;
export default app;

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}/health\n📖 OpenAPI docs at http://${app.server?.hostname}:${app.server?.port}/openapi`
);
