import "server-only";
import { env } from "@crabfold/env/web";
import { treaty } from "@elysiajs/eden";
import { cookies } from "next/headers";

import type { App } from "../../../server/src/index";

export async function apiServer() {
  const cookieStore = await cookies();

  return treaty<App>(env.NEXT_PUBLIC_SERVER_URL, {
    fetch: {
      cache: "no-store" as RequestCache,
    },
    headers: {
      cookie: cookieStore.toString(),
    },
  });
}
