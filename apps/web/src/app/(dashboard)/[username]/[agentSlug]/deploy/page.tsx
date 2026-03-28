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

async function checkConnections(agentId: string): Promise<{
  railway: boolean;
  github: boolean;
}> {
  const api = await apiServer();
  const { data, status } = await api.api.agents({ id: agentId }).deploy.get();
  if (status !== 200 || !data || "error" in data) {
    return { github: false, railway: false };
  }
  return { github: data.github, railway: data.railway };
}

export default async function DeployPage({
  params,
}: {
  params: Promise<{ username: string; agentSlug: string }>;
}) {
  const { username, agentSlug } = await params;
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const agentId = await resolveAgentId(session.user.id, agentSlug);

  const connections = agentId
    ? await checkConnections(agentId)
    : { github: false, railway: false };

  return (
    <DeployClient
      agentId={agentId}
      username={username}
      agentSlug={agentSlug}
      connections={connections}
    />
  );
}
