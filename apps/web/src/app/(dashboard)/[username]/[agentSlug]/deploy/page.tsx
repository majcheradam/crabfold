import { env } from "@crabfold/env/web";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-server";

import { DeployClient } from "./deploy-client";

async function resolveAgentId(
  userId: string,
  agentSlug: string
): Promise<string | null> {
  const cookieStore = await cookies();
  const res = await fetch(
    `${env.NEXT_PUBLIC_SERVER_URL}/api/agents?userId=${userId}`,
    {
      cache: "no-store",
      headers: { cookie: cookieStore.toString() },
    }
  );
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  const match = (data.agents ?? []).find(
    (a: { slug: string }) => a.slug === agentSlug
  );
  return match?.id ?? null;
}

export default async function DeployPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; agentSlug: string }>;
  searchParams: Promise<{ autoRetry?: string }>;
}) {
  const { username, agentSlug } = await params;
  const { autoRetry } = await searchParams;
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const agentId = await resolveAgentId(session.user.id, agentSlug);

  return (
    <DeployClient
      agentId={agentId}
      username={username}
      agentSlug={agentSlug}
      autoRetry={autoRetry === "true"}
    />
  );
}
