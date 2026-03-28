"use client";

import { Input } from "@crabfold/ui/components/input";
import { BotIcon, Check, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const MOCK_AGENTS = [
  {
    icon: <BotIcon className="size-4" />,
    name: "github-issue-triager",
    slug: "github-issue-triager",
  },
  {
    icon: <BotIcon className="size-4" />,
    name: "slack-standup-bot",
    slug: "slack-standup-bot",
  },
];

export default function ThreadsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = MOCK_AGENTS.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-lg font-semibold text-foreground">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Choose an agent to view sessions
          </p>
        </div>

        <div className="flex w-full flex-col border border-border">
          {/* Search */}
          <div className="border-b border-border p-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find Agent..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>

          {/* Agent list */}
          <div className="flex flex-col">
            {filtered.map((agent) => (
              <Link
                key={agent.slug}
                href={`/demo/${agent.slug}/threads`}
                onMouseEnter={() => setSelected(agent.slug)}
                onMouseLeave={() => setSelected(null)}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  selected === agent.slug ? "bg-foreground/5" : ""
                }`}
              >
                <span className="text-muted-foreground">{agent.icon}</span>
                <span className="flex-1 text-sm text-foreground">
                  {agent.name}
                </span>
                {selected === agent.slug && (
                  <Check className="size-4 text-foreground" />
                )}
              </Link>
            ))}

            {/* Create new */}
            <Link
              href="/new"
              className="flex items-center gap-3 border-t border-border px-4 py-3 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="size-4" />
              <span className="text-sm">Create Agent</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
