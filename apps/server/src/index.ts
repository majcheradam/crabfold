import { auth } from "@crabfold/auth";
import { env } from "@crabfold/env/server";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";

import { agentsModule } from "./modules/agents";
import { apiKeysModule } from "./modules/api-keys";
import { channelsModule } from "./modules/channels";
import { connectorsModule } from "./modules/connectors";
import { dashboardModule } from "./modules/dashboard";
import { deployModule } from "./modules/deploy";
import { gatewayModule } from "./modules/gateway";
import { jobsModule } from "./modules/jobs";
import { observabilityModule } from "./modules/observability";
import { threadsModule } from "./modules/threads";

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
  .use(dashboardModule)
  .use(agentsModule)
  .use(deployModule)
  .use(channelsModule)
  .use(apiKeysModule)
  .use(jobsModule)
  .use(threadsModule)
  .use(connectorsModule)
  .use(gatewayModule)
  .use(observabilityModule)
  .get("/", () => "OK", { detail: { hide: true } })
  .listen(3000);

export type App = typeof app;
export default app;

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}/health\n📖 OpenAPI docs at http://${app.server?.hostname}:${app.server?.port}/openapi`
);
