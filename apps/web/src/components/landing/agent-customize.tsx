"use client";

import { Button } from "@crabfold/ui/components/button";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { FrameworkTile } from "@/components/landing/tiles/framework-tile";
import { SkillsTile } from "@/components/landing/tiles/skills-tile";
import { WorkspaceTile } from "@/components/landing/tiles/workspace-tile";

export type Framework = "openclaw" | "ironclaw" | "nanobot";

export interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface WorkspaceFile {
  name: string;
  content: string;
}

const INITIAL_SKILLS: Skill[] = [
  {
    description: "Label and assign incoming GitHub issues based on content",
    enabled: true,
    id: "github-triage",
    name: "GitHub Triage",
  },
  {
    description: "Post summaries and alerts to Slack channels",
    enabled: true,
    id: "slack-notify",
    name: "Slack Notify",
  },
  {
    description: "Search the web for context and references",
    enabled: false,
    id: "web-search",
    name: "Web Search",
  },
  {
    description: "Review pull requests and suggest improvements",
    enabled: false,
    id: "code-review",
    name: "Code Review",
  },
  {
    description: "Store and retrieve long-term context from past interactions",
    enabled: true,
    id: "memory-recall",
    name: "Memory Recall",
  },
  {
    description: "Read and create calendar events for scheduling",
    enabled: false,
    id: "calendar-sync",
    name: "Calendar Sync",
  },
];

const INITIAL_FILES: WorkspaceFile[] = [
  {
    content: `name: github-issue-triager
framework: openclaw
version: 1.0.0

gateway:
  channels:
    - type: github
      repo: "your-org/your-repo"
      events: [issues.opened, issues.edited]

brain:
  model: claude-sonnet-4-6
  strategy: react
  max_iterations: 5

heartbeat:
  schedule: "*/5 * * * *"
  tasks:
    - check_unassigned_issues

memory:
  backend: markdown
  path: ./memory`,
    name: "config.yaml",
  },
  {
    content: `# GitHub Issue Triager

An autonomous agent that monitors GitHub repositories
for new issues and automatically triages them.

## Capabilities
- Classify issues by type (bug, feature, question)
- Apply appropriate labels
- Assign to team members based on expertise
- Post triage summary to Slack`,
    name: "WORKSPACE.md",
  },
  {
    content: `# Agent Context

## Team Members
- @alice — frontend, React
- @bob — backend, Go
- @carol — infra, DevOps

## Label Taxonomy
- bug, feature, question, docs, security
- priority/high, priority/medium, priority/low`,
    name: "memory/context.md",
  },
];

export function AgentCustomize({
  prompt,
  onBack,
}: {
  prompt: string;
  onBack: () => void;
}) {
  const [framework, setFramework] = useState<Framework>("openclaw");
  const [skills, setSkills] = useState<Skill[]>(INITIAL_SKILLS);
  const [files, setFiles] = useState<WorkspaceFile[]>(INITIAL_FILES);

  const handleToggleSkill = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleUpdateFile = (name: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.name === name ? { ...f, content } : f))
    );
  };

  return (
    <div className="flex min-h-svh flex-col items-center px-4 py-12">
      <div className="flex w-full max-w-4xl flex-col gap-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">
              Customize your agent
            </h2>
            <p className="text-xs text-muted-foreground">{prompt}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="gap-1.5"
          >
            <ArrowLeft className="size-3" />
            Back
          </Button>
        </div>

        {/* Framework */}
        <FrameworkTile selected={framework} onSelect={setFramework} />

        {/* Skills */}
        <SkillsTile skills={skills} onToggle={handleToggleSkill} />

        {/* Workspace files */}
        <WorkspaceTile files={files} onUpdateFile={handleUpdateFile} />

        {/* Save */}
        <Button size="lg" onClick={onBack} className="self-end gap-1.5">
          Save changes
        </Button>
      </div>
    </div>
  );
}
