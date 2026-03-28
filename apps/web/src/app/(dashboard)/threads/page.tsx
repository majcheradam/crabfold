import { redirect } from "next/navigation";

import { apiServer } from "@/lib/api-server";
import { getSession } from "@/lib/auth-server";

import { ThreadsClient } from "./threads-client";

async function fetchAgents(userId: string) {
  const api = await apiServer();
  const { data, status } = await api.api.agents.get({ query: { userId } });
  if (status !== 200 || !data || "error" in data) {
    return [];
  }
  return data.agents;
}

export default async function ThreadsPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const agents = await fetchAgents(session.user.id);

  return <ThreadsClient agents={agents} username={session.user.name} />;
}
