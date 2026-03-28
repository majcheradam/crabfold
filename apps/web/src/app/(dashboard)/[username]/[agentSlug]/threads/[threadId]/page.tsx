import { notFound, redirect } from "next/navigation";

import { apiServer } from "@/lib/api-server";
import { getSession } from "@/lib/auth-server";

import { ThreadDetailClient } from "./thread-detail-client";

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ username: string; agentSlug: string; threadId: string }>;
}) {
  const { username, agentSlug, threadId } = await params;
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

  const { data: history, status } =
    await api.api.agents[agent.id].threads[threadId].get();

  const threadHistory =
    status === 200 && history && "messages" in history ? history : null;

  if (!threadHistory) {
    notFound();
  }

  return (
    <ThreadDetailClient
      agentId={agent.id}
      agentSlug={agentSlug}
      username={username}
      threadId={threadId}
      title={threadHistory.title}
      initialMessages={threadHistory.messages}
    />
  );
}
