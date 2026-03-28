import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { apiServer } from "@/lib/api-server";
import { getSession } from "@/lib/auth-server";

import { AgentCard } from "./agent-card";

async function fetchAgents(userId: string) {
  const api = await apiServer();
  const { data, status } = await api.api.agents.get({ query: { userId } });
  if (status !== 200 || !data || "error" in data) {
    return [];
  }
  return data.agents;
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const agents = await fetchAgents(session.user.id);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between pb-6">
        <h1 className="text-lg font-semibold text-foreground">Your agents</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} username={username} />
        ))}

        <Link
          href="/new"
          className="flex flex-col items-center justify-center gap-2 border border-dashed border-border p-4 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
        >
          <Plus className="size-5" />
          <span className="text-xs">New Agent</span>
        </Link>
      </div>
    </div>
  );
}
