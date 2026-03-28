"use client";

import { Button } from "@crabfold/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@crabfold/ui/components/card";
import {
  Activity,
  Calendar,
  Clock,
  ExternalLink,
  FileCode2,
  Globe,
  MessageSquare,
  Rocket,
  RotateCcw,
  Settings,
  Sparkles,
  Zap,
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

const statusConfig: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  deploying: {
    color:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
    dot: "bg-amber-500 animate-pulse",
    label: "Deploying",
  },
  draft: {
    color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    dot: "bg-zinc-400",
    label: "Draft",
  },
  error: {
    color: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400",
    dot: "bg-red-500",
    label: "Error",
  },
  live: {
    color:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
    dot: "bg-emerald-500",
    label: "Live",
  },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${days}d ago`;
}

export function OverviewClient({ agent, username }: OverviewClientProps) {
  const router = useRouter();
  const status = statusConfig[agent.status] ?? statusConfig.draft;

  const handleRebuild = () => {
    router.push(
      `/new?prompt=${encodeURIComponent(agent.config.prompt ?? agent.name)}`
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Hero header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {agent.name}
            </h1>
            {agent.status === "deploying" && agent.railwayProjectId ? (
              <a
                href={`https://railway.com/project/${agent.railwayProjectId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color} transition-colors hover:opacity-80`}
              >
                <span className={`size-1.5 rounded-full ${status.dot}`} />
                Deploying&hellip;
                <ExternalLink className="size-3" />
              </a>
            ) : (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}
              >
                <span className={`size-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="size-3" />
              {forkLabels[agent.fork] ?? agent.fork}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              Created {formatDate(agent.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              Updated {timeAgo(agent.updatedAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Link href={`/${username}/${agent.slug}/channels`}>
            <Button variant="ghost" size="icon-sm">
              <MessageSquare className="size-3.5" />
            </Button>
          </Link>
          <Link href={`/${username}/${agent.slug}/threads`}>
            <Button variant="ghost" size="icon-sm">
              <SpoolIcon className="size-3.5" />
            </Button>
          </Link>
          <Link href={`/${username}/${agent.slug}/editor`}>
            <Button variant="ghost" size="icon-sm">
              <Settings className="size-3.5" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon-sm" onClick={handleRebuild}>
            <RotateCcw className="size-3.5" />
          </Button>
          <Link href={`/${username}/${agent.slug}/deploy`}>
            <Button size="sm" className="ml-1 gap-1.5">
              <Rocket className="size-3" />
              Deploy
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card size="sm">
          <CardContent className="flex items-center gap-3 pt-0">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Framework</p>
              <p className="text-sm font-semibold">
                {forkLabels[agent.fork] ?? agent.fork}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3 pt-0">
            <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/10">
              <Sparkles className="size-4 text-violet-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Skills</p>
              <p className="text-sm font-semibold">{agent.skills.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3 pt-0">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10">
              <MessageSquare className="size-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Channels</p>
              <p className="text-sm font-semibold">
                {agent.config.channels.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3 pt-0">
            <div className="flex size-9 items-center justify-center rounded-lg bg-orange-500/10">
              <FileCode2 className="size-4 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Files</p>
              <p className="text-sm font-semibold">{agent.files.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column - takes 2 cols */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* System prompt */}
          <Card size="sm">
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="size-4 text-muted-foreground" />
                System Prompt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {agent.soul || agent.config.prompt || "No system prompt set."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Skills */}
          <Card size="sm">
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4 text-muted-foreground" />
                Skills
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {agent.skills.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agent.skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {agent.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No skills installed yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Channels */}
          <Card size="sm">
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageSquare className="size-4 text-muted-foreground" />
                Channels
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agent.config.channels.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {agent.config.channels.map((channel) => (
                    <div
                      key={channel.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                    >
                      <Globe className="size-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {channel.label}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No channels connected.
                </p>
              )}
              <Link
                href={`/${username}/${agent.slug}/channels`}
                className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Manage channels
                <ExternalLink className="size-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Files */}
          <Card size="sm">
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileCode2 className="size-4 text-muted-foreground" />
                Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agent.files.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {agent.files.map((file) => (
                    <div
                      key={file.path}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    >
                      <FileCode2 className="size-3 shrink-0" />
                      <span className="truncate font-mono text-xs">
                        {file.path}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No files generated yet.
                </p>
              )}
              <Link
                href={`/${username}/${agent.slug}/editor`}
                className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open editor
                <ExternalLink className="size-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Deployment */}
          {agent.deploymentUrl && (
            <Card size="sm">
              <CardHeader className="border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Rocket className="size-4 text-muted-foreground" />
                  Deployment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={agent.deploymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Globe className="size-3.5" />
                  <span className="truncate">{agent.deploymentUrl}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
