import { redirect } from "next/navigation";

import { apiServer } from "@/lib/api-server";
import { getSession } from "@/lib/auth-server";

import { DeployClient } from "./deploy-client";

async function resolveAgentId(
  userId: string,
  agentSlug: string
): Promise<string | null> {
  const api = await apiServer();
  const { data, status } = await api.api.agents.get({ query: { userId } });
  if (status !== 200 || !data || "error" in data) {
    return null;
  }
  const match = data.agents.find((a) => a.slug === agentSlug);
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
