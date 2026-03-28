"use client";

import { Button } from "@crabfold/ui/components/button";
import { Input } from "@crabfold/ui/components/input";
import { Download, Rocket, RotateCcw, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Agent {
  id: string;
  slug: string;
  name: string;
  fork: "openclaw" | "nanobot" | "ironclaw";
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
  ironclaw: "IronClaw",
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
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const handleRebuild = () => {
    router.push(
      `/new?prompt=${encodeURIComponent(agent.config.prompt ?? agent.name)}`
    );
  };

  const handleDelete = () => {
    router.push(`/${username}`);
  };

  const channelsDisplay =
    agent.config.channels.length > 0
      ? agent.config.channels.map((c) => c.label).join(", ")
      : "None";

  const skillsDisplay =
    agent.skills.length > 0 ? agent.skills.join(", ") : "None";

  return (
    <div className="flex flex-col gap-6">
      {/* Actions */}
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {agent.name}
          </h2>
          <span className="border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {statusLabels[agent.status] ?? agent.status}
          </span>
        </div>
        <div className="flex gap-1.5">
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
        </div>
      </div>

      {/* Agent summary */}
      <div className="flex flex-col gap-4 border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Agent summary</h3>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Framework
            </span>
            <span className="text-xs font-medium text-foreground">
              {forkLabels[agent.fork] ?? agent.fork}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Skills
            </span>
            <span className="text-xs font-medium text-foreground">
              {skillsDisplay}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Channels
            </span>
            <span className="text-xs font-medium text-foreground">
              {channelsDisplay}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Files
            </span>
            <span className="text-xs font-medium text-foreground">
              {agent.files.length}
            </span>
          </div>
        </div>
      </div>

      {/* Export actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="group flex flex-col gap-2 border border-border p-4 text-left transition-colors hover:border-foreground/20"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Download className="size-3.5" />
            Download ZIP
          </div>
          <p className="text-xs text-muted-foreground">
            Download the full agent workspace as a ZIP archive
          </p>
        </button>

        <Link href={`/${username}/${agent.slug}/deploy`}>
          <div className="group flex flex-col gap-2 border border-border bg-foreground p-4 text-left text-background transition-colors hover:bg-foreground/90">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Rocket className="size-3.5" />
              Deploy to Railway
            </div>
            <p className="text-xs opacity-70">
              One-click deploy your agent to Railway infrastructure
            </p>
          </div>
        </Link>
      </div>

      {/* Delete */}
      <div className="flex items-center justify-between border border-destructive/20 p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-destructive">
            Delete this agent
          </span>
          <span className="text-xs text-muted-foreground">
            This action cannot be undone
          </span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowDelete(true)}
        >
          <Trash2 className="size-3" />
          Delete
        </Button>
      </div>

      {/* Delete confirmation modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="flex w-full max-w-md flex-col gap-4 border border-border bg-card p-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Delete {agent.name}?
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                This will permanently delete this agent, its configuration,
                skills, and all associated data. This action cannot be undone.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted-foreground">
                Type{" "}
                <span className="font-medium text-foreground">
                  {agent.slug}
                </span>{" "}
                to confirm
              </label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={agent.slug}
              />
            </div>
            <div className="flex justify-end gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDelete(false);
                  setDeleteConfirm("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteConfirm !== agent.slug}
                onClick={handleDelete}
                className="gap-1.5"
              >
                <Trash2 className="size-3" />
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
