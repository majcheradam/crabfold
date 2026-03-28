import { env } from "@crabfold/env/web";
import { treaty } from "@elysiajs/eden";

import type { App } from "../../../server/src/index";

export const api = treaty<App>(env.NEXT_PUBLIC_SERVER_URL, {
  fetch: {
    credentials: "include",
  },
});
