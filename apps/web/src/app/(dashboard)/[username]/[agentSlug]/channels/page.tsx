import { redirect } from "next/navigation";

import { apiServer } from "@/lib/api-server";
import { getSession } from "@/lib/auth-server";

import { ChannelsClient } from "./channels-client";

async function resolveAgent(agentSlug: string) {
  const api = await apiServer();
  const { data, status } = await api.api.agents["by-slug"]({
    slug: agentSlug,
  }).get();
  if (status !== 200 || !data || "error" in data) {
    return null;
  }
  return {
    channels: data.config?.channels ?? [],
    deploymentUrl: data.deploymentUrl,
    id: data.id,
    name: data.name,
    status: data.status,
  };
}

export default async function ChannelsPage({
  params,
}: {
  params: Promise<{ username: string; agentSlug: string }>;
}) {
  const { username, agentSlug } = await params;
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const agent = await resolveAgent(agentSlug);

  if (!agent) {
    redirect(`/${username}`);
  }

  return (
    <ChannelsClient
      agentId={agent.id}
      agentName={agent.name}
      agentStatus={agent.status}
      channels={agent.channels}
      deploymentUrl={agent.deploymentUrl}
      username={username}
      agentSlug={agentSlug}
    />
  );
}
