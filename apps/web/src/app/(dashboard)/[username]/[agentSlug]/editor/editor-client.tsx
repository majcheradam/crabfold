"use client";

import { Button } from "@crabfold/ui/components/button";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FrameworkTile } from "@/components/landing/tiles/framework-tile";
import { SkillsTile } from "@/components/landing/tiles/skills-tile";
import { WorkspaceTile } from "@/components/landing/tiles/workspace-tile";
import { api } from "@/lib/api-client";
import type { Framework, Skill, WorkspaceFile } from "@/lib/types";

function saveButtonLabel(state: string): string {
  if (state === "saving") {
    return "Saving...";
  }
  if (state === "saved") {
    return "Saved";
  }
  if (state === "error") {
    return "Save failed -- retry";
  }
  return "Save changes";
}

interface AgentData {
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
  };
  files: { path: string; content: string }[];
  skills: string[];
}

function buildSkills(agentSkills: string[]): Skill[] {
  return agentSkills.map((slug) => ({
    description: "",
    enabled: true,
    id: slug,
    name: slug,
  }));
}

function buildFiles(
  agentFiles: { path: string; content: string }[]
): WorkspaceFile[] {
  return agentFiles.map((f) => ({
    content: f.content,
    name: f.path,
  }));
}

type SaveState = "idle" | "saving" | "saved" | "error";

interface EditorClientProps {
  agent: AgentData;
  username: string;
}

export function EditorClient({ agent, username }: EditorClientProps) {
  const router = useRouter();
  const [framework, setFramework] = useState<Framework>(agent.fork);
  const [skills, setSkills] = useState<Skill[]>(buildSkills(agent.skills));
  const [files, setFiles] = useState<WorkspaceFile[]>(buildFiles(agent.files));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [forkSwitching, setForkSwitching] = useState(false);

  async function handleFrameworkChange(newFork: Framework) {
    if (newFork === framework || forkSwitching) {
      return;
    }

    setForkSwitching(true);
    const { data, status } = await api.api
      .agents({ id: agent.id })
      .fork.post({ from: framework, to: newFork });

    if (status === 200 && data && "newFiles" in data) {
      setFramework(newFork);
      setFiles(
        (data.newFiles as { path: string; content: string }[]).map((f) => ({
          content: f.content,
          name: f.path,
        }))
      );
    }
    setForkSwitching(false);
  }

  async function handleToggleSkill(id: string) {
    const skill = skills.find((s) => s.id === id);
    if (!skill) {
      return;
    }

    const wasEnabled = skill.enabled;

    // Optimistic update
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );

    const body = wasEnabled
      ? { disable: [id], enable: [] as string[] }
      : { disable: [] as string[], enable: [id] };

    const { status } = await api.api
      .agents({ id: agent.id })
      .skills.patch(body);

    if (status !== 200) {
      // Revert on failure
      setSkills((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: wasEnabled } : s))
      );
    }
  }

  function handleUpdateFile(name: string, content: string) {
    setFiles((prev) =>
      prev.map((f) => (f.name === name ? { ...f, content } : f))
    );
  }

  async function handleSave() {
    setSaveState("saving");

    const soulFile = files.find((f) => f.name === "SOUL.md");
    const soulContent = soulFile?.content ?? agent.soul;

    const { status } = await api.api
      .agents({ id: agent.id })
      .patch({ soul: soulContent });

    if (status === 200) {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } else {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {agent.name || agent.slug}
          </h2>
          <span className="border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/${username}/${agent.slug}`)}
          className="gap-1.5"
        >
          <ArrowLeft className="size-3" />
          Back
        </Button>
      </div>

      {/* Framework */}
      <div className="relative">
        <FrameworkTile selected={framework} onSelect={handleFrameworkChange} />
        {forkSwitching && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Skills */}
      <SkillsTile skills={skills} onToggle={handleToggleSkill} />

      {/* Workspace files */}
      <WorkspaceTile files={files} onUpdateFile={handleUpdateFile} />

      {/* Save */}
      <Button
        size="lg"
        className="self-end gap-1.5"
        onClick={handleSave}
        disabled={saveState === "saving" || saveState === "saved"}
      >
        {saveState === "saving" && (
          <Loader2 className="size-3.5 animate-spin" />
        )}
        {saveState === "saved" && <Check className="size-3.5" />}
        {saveButtonLabel(saveState)}
      </Button>
    </div>
  );
}
