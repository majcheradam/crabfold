import { notFound, redirect } from "next/navigation";

import { apiServer } from "@/lib/api-server";
import { getSession } from "@/lib/auth-server";

import { ThreadsClient } from "./threads-client";

export default async function ThreadsPage({
  params,
}: {
  params: Promise<{ username: string; agentSlug: string }>;
}) {
  const { username, agentSlug } = await params;
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const api = await apiServer();
  const { data: agent, status: agentStatus } =
    await api.api.agents["by-slug"][agentSlug].get();

  if (agentStatus !== 200 || !agent || "error" in agent) {
    notFound();
  }

  const { data, status } = await api.api.agents[agent.id].threads.get();

  const threads =
    status === 200 && data && "threads" in data ? data.threads : [];

  return (
    <ThreadsClient
      threads={threads}
      username={username}
      agentSlug={agentSlug}
    />
  );
}
