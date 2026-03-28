"use client";

import { Button } from "@crabfold/ui/components/button";
import {
  ExternalLink,
  MessageSquare,
  Rocket,
  RotateCcw,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { SpoolIcon } from "@/components/icons/spool";

interface Agent {
  id: string;
  slug: string;
  name: string;
  fork: "openclaw" | "nanobot";
  status: "draft" | "deploying" | "live" | "error";
  soul: string;
  config: {
    fork: string;
    prompt: string;
    skills: string[];
    channels: { id: string; label: string }[];
    reasoning?: string;
  };
  files: { path: string; content: string }[];
  skills: string[];
  deploymentUrl: string | null;
  railwayProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OverviewClientProps {
  agent: Agent;
  username: string;
}

const forkLabels: Record<string, string> = {
  nanobot: "Nanobot",
  openclaw: "OpenClaw",
};

const statusLabels: Record<string, string> = {
  deploying: "Deploying",
  draft: "Draft",
  error: "Error",
  live: "Live",
};

export function OverviewClient({ agent, username }: OverviewClientProps) {
  const router = useRouter();

  const handleRebuild = () => {
    router.push(
      `/new?prompt=${encodeURIComponent(agent.config.prompt ?? agent.name)}`
    );
  };

  const channelsDisplay =
    agent.config.channels.length > 0
      ? agent.config.channels.map((c) => c.label).join(", ")
      : "None";

  const skillsDisplay =
    agent.skills.length > 0 ? agent.skills.join(", ") : "None";

  return (
    <div className="flex flex-col gap-4">
      {/* Actions */}
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {agent.name}
          </h2>
          {agent.status === "deploying" && agent.railwayProjectId ? (
            <a
              href={`https://railway.com/project/${agent.railwayProjectId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Deploying&hellip;
              <ExternalLink className="size-2.5" />
            </a>
          ) : (
            <span className="border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {statusLabels[agent.status] ?? agent.status}
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          <Link href={`/${username}/${agent.slug}/channels`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <MessageSquare className="size-3" />
              Channels
            </Button>
          </Link>
          <Link href={`/${username}/${agent.slug}/threads`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SpoolIcon className="size-3" />
              Sessions
            </Button>
          </Link>
          <Link href={`/${username}/${agent.slug}/editor`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="size-3" />
              Customize
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRebuild}
            className="gap-1.5"
          >
            <RotateCcw className="size-3" />
            Rebuild
          </Button>
          <Link href={`/${username}/${agent.slug}/deploy`}>
            <Button size="sm" className="gap-1.5">
              <Rocket className="size-3" />
              Deploy to Railway
            </Button>
          </Link>
        </div>
      </div>

      {/* Agent summary */}
      <div className="grid grid-cols-4 border border-border">
        <div className="flex flex-col gap-1 border-r border-border p-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
            Framework
          </span>
          <span className="text-xs font-medium text-foreground">
            {forkLabels[agent.fork] ?? agent.fork}
          </span>
        </div>
        <div className="flex flex-col gap-1 border-r border-border p-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
            Skills
          </span>
          <span className="text-xs font-medium text-foreground">
            {skillsDisplay}
          </span>
        </div>
        <div className="flex flex-col gap-1 border-r border-border p-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
            Channels
          </span>
          <span className="text-xs font-medium text-foreground">
            {channelsDisplay}
          </span>
        </div>
        <div className="flex flex-col gap-1 p-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
            Files
          </span>
          <span className="text-xs font-medium text-foreground">
            {agent.files.length}
          </span>
        </div>
      </div>
    </div>
  );
}
