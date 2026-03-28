"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { api } from "@/lib/api-client";

interface AgentCardProps {
  agent: {
    id: string;
    slug: string;
    name: string;
    fork: string;
    status: string;
    threadCount: number;
    lastActive: string;
  };
  username: string;
}

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

export function AgentCard({ agent, username }: AgentCardProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirming) {
      setConfirming(true);
      timeoutRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setDeleting(true);

    const { status } = await api.api.agents({ id: agent.id }).delete();
    if (status === 200) {
      router.refresh();
    } else {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <Link
      href={`/${username}/${agent.slug}`}
      className="group relative flex flex-col gap-3 border border-border p-4 transition-colors hover:border-foreground/20"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          {agent.name}
        </span>
        <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className={`rounded p-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 ${
              confirming
                ? "bg-red-500/10 text-red-500 opacity-100"
                : "hover:bg-muted hover:text-foreground"
            } ${deleting ? "animate-pulse" : ""}`}
            title={confirming ? "Click again to confirm" : "Delete agent"}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="border border-border px-1.5 py-0.5 text-[10px]">
          {agent.fork}
        </span>
        <span>{agent.threadCount} threads</span>
        <span>{timeAgo(agent.lastActive)}</span>
      </div>
    </Link>
  );
}
