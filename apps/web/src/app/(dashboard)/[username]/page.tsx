import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { apiServer } from "@/lib/api-server";
import { getSession } from "@/lib/auth-server";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) {
    return "just now";
  }
  if (mins < 60) {
    return `${mins} min ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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
          <Link
            key={agent.id}
            href={`/${username}/${agent.slug}`}
            className="flex flex-col gap-3 border border-border p-4 transition-colors hover:border-foreground/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {agent.name}
              </span>
              <span
                className={`flex items-center gap-1 text-[10px] ${
                  agent.status === "live"
                    ? "text-green-500"
                    : "text-muted-foreground"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    agent.status === "live"
                      ? "bg-green-500"
                      : "bg-muted-foreground/30"
                  }`}
                />
                {agent.status}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="border border-border px-1.5 py-0.5 text-[10px]">
                {agent.fork}
              </span>
              <span>{agent.threadCount} threads</span>
              <span>{timeAgo(agent.lastActive)}</span>
            </div>
          </Link>
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
