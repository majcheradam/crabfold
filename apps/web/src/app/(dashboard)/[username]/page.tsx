"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const MOCK_AGENTS = [
  {
    fork: "openclaw",
    lastActive: "2 min ago",
    name: "GitHub Issue Triager",
    slug: "github-issue-triager",
    status: "live" as const,
    threads: 12,
  },
  {
    fork: "nanobot",
    lastActive: "1 hour ago",
    name: "Slack Standup Bot",
    slug: "slack-standup-bot",
    status: "draft" as const,
    threads: 0,
  },
];

export default function DashboardPage() {
  const params = useParams<{ username: string }>();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between pb-6">
        <h1 className="text-lg font-semibold text-foreground">Your agents</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_AGENTS.map((agent) => (
          <Link
            key={agent.slug}
            href={`/${params.username}/${agent.slug}`}
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
              <span>{agent.threads} threads</span>
              <span>{agent.lastActive}</span>
            </div>
          </Link>
        ))}

        {/* New agent card */}
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
