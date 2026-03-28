"use client";

import { Button } from "@crabfold/ui/components/button";
import {
  Copy,
  Check,
  Download,
  GitBranch,
  Rocket,
  RotateCcw,
  Settings,
} from "lucide-react";
import { useState } from "react";

export function AgentResult({
  prompt,
  onRebuild,
  onCustomize,
}: {
  prompt: string;
  onRebuild: () => void;
  onCustomize: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyClone = () => {
    navigator.clipboard.writeText(
      "npx crabfold clone github-issue-triager ./my-agent"
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-4xl flex-col gap-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">
              Your agent is ready
            </h2>
            <p className="text-xs text-muted-foreground">{prompt}</p>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={onCustomize}
              className="gap-1.5"
            >
              <Settings className="size-3" />
              Customize
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRebuild}
              className="gap-1.5"
            >
              <RotateCcw className="size-3" />
              Rebuild
            </Button>
          </div>
        </div>

        {/* Agent summary */}
        <div className="flex flex-col gap-4 border border-border p-4">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-foreground">
              How your agent was built
            </h3>
            <div className="flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
              <p>
                Based on your prompt, crabfold selected{" "}
                <span className="text-foreground">OpenClaw</span> as the runtime
                framework — it provides the full Gateway, Brain, Memory, Skills,
                and Heartbeat architecture needed for continuous autonomous
                operation.
              </p>
              <p>
                The agent uses a{" "}
                <span className="text-foreground">ReAct reasoning loop</span>{" "}
                with Claude Sonnet to classify incoming GitHub issues, apply
                labels, and assign owners. A{" "}
                <span className="text-foreground">Heartbeat</span> schedule
                polls for unassigned issues every 5 minutes as a safety net.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                Framework
              </span>
              <span className="text-xs font-medium text-foreground">
                OpenClaw
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                Skills
              </span>
              <span className="text-xs font-medium text-foreground">
                GitHub Triage, Slack Notify, Memory Recall
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                Model
              </span>
              <span className="text-xs font-medium text-foreground">
                Claude Sonnet 4.6
              </span>
            </div>
          </div>
        </div>

        {/* Export actions */}
        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="group flex flex-col gap-2 border border-border p-4 text-left transition-colors hover:border-foreground/20"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Copy className="size-3.5" />
              Copy config
            </div>
            <p className="text-xs text-muted-foreground">
              Copy the full workspace config to your clipboard
            </p>
          </button>

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

          <button
            type="button"
            className="group flex flex-col gap-2 border border-border bg-foreground p-4 text-left text-background transition-colors hover:bg-foreground/90"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Rocket className="size-3.5" />
              Deploy to Railway
            </div>
            <p className="text-xs opacity-70">
              One-click deploy your agent to Railway infrastructure
            </p>
          </button>
        </div>

        {/* Clone command */}
        <div className="flex items-center gap-3 border border-border px-4 py-3">
          <GitBranch className="size-3.5 text-muted-foreground" />
          <code className="flex-1 font-mono text-xs text-muted-foreground">
            npx crabfold clone github-issue-triager ./my-agent
          </code>
          <button
            type="button"
            onClick={handleCopyClone}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
