"use client";

import { env } from "@crabfold/env/web";
import { Button } from "@crabfold/ui/components/button";
import { Check, Loader2, Pencil, Rocket, Terminal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Hero } from "@/components/landing/hero";
import { api } from "@/lib/api-client";

interface StepInfo {
  step: string;
  label: string;
  status: "running" | "done" | "error";
  data: Record<string, unknown>;
}

interface AgentResult {
  agentId: string;
  slug: string;
  fork: string;
  skills: string[];
  channels: string[];
  fileCount: number;
}

type Phase = "idle" | "scaffolding" | "summary" | "error";

export function NewAgentClient({
  prompt: initialPrompt,
  username,
}: {
  prompt: string;
  username: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(
    initialPrompt ? "scaffolding" : "idle"
  );
  const [prompt, setPrompt] = useState(initialPrompt);
  const [steps, setSteps] = useState<StepInfo[]>([]);
  const [soul, setSoul] = useState("");
  const [agent, setAgent] = useState<AgentResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const scaffoldRef = useRef<{
    fork: string;
    skills: string[];
    channels: string[];
    fileCount: number;
  }>({ channels: [], fileCount: 0, fork: "", skills: [] });
  const started = useRef(false);

  function startScaffold(text: string) {
    setPrompt(text);
    setPhase("scaffolding");
    setSteps([]);
    setSoul("");
    scaffoldRef.current = { channels: [], fileCount: 0, fork: "", skills: [] };

    (async () => {
      const { data, status } = await api.api.agents.create.post({
        prompt: text,
      });

      if (status !== 200 || !data || !("jobId" in data)) {
        setPhase("error");
        setErrorMsg("Failed to start scaffold");
        return;
      }

      const jobId = data.jobId as string;

      const evtSource = new EventSource(
        `${env.NEXT_PUBLIC_SERVER_URL}/api/jobs/${jobId}/stream`,
        { withCredentials: true }
      );

      evtSource.addEventListener("message", (e) => {
        const evt = JSON.parse(e.data) as StepInfo;
        if (!evt.step || !evt.label) {
          return;
        }

        // Extract data from completed steps
        if (evt.status === "done" && evt.data) {
          if (evt.step === "fork" && evt.data.fork) {
            scaffoldRef.current.fork = evt.data.fork as string;
          }
          if (evt.step === "skills" && evt.data.skills) {
            scaffoldRef.current.skills = evt.data.skills as string[];
          }
          if (evt.step === "channels" && evt.data.channels) {
            const channels = evt.data.channels as { id: string }[];
            scaffoldRef.current.channels = channels.map((c) => c.id);
          }
          if (evt.step === "files" && evt.data.count) {
            scaffoldRef.current.fileCount = evt.data.count as number;
          }
        }

        setSteps((prev) => {
          const idx = prev.findIndex((s) => s.step === evt.step);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = evt;
            return next;
          }
          return [...prev, evt];
        });
      });

      evtSource.addEventListener("soul_chunk", (e) => {
        const evt = JSON.parse(e.data);
        const chunk = evt.data?.text ?? "";
        if (chunk) {
          setSoul((prev) => prev + chunk);
        }
      });

      evtSource.addEventListener("complete", (e) => {
        evtSource.close();
        const evt = JSON.parse(e.data);
        setAgent({
          agentId: evt.data.agentId,
          channels: scaffoldRef.current.channels,
          fileCount: scaffoldRef.current.fileCount,
          fork: scaffoldRef.current.fork,
          skills: scaffoldRef.current.skills,
          slug: evt.data.slug,
        });
        setPhase("summary");
        router.refresh();
      });

      evtSource.addEventListener("error", () => {
        if (evtSource.readyState === EventSource.CLOSED) {
          return;
        }
        evtSource.close();
        setPhase("error");
        setErrorMsg("Scaffold stream interrupted");
      });
    })();
  }

  // Auto-start if prompt was provided via URL
  if (initialPrompt && !started.current) {
    started.current = true;
    startScaffold(initialPrompt);
  }

  if (phase === "idle") {
    return (
      <div className="flex min-h-[calc(100svh-3rem)] flex-col">
        <Hero onSubmit={startScaffold} />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-destructive">{errorMsg}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPhase("idle");
            setErrorMsg("");
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (phase === "scaffolding") {
    return (
      <div className="flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-xl flex-col gap-6">
          {/* Prompt echo */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground/60">
              Your prompt
            </span>
            <p className="text-sm text-foreground">{prompt}</p>
          </div>

          {/* Terminal progress */}
          <div className="border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Terminal className="size-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                crabfold scaffold
              </span>
            </div>
            <div className="flex flex-col gap-0 p-3 font-mono text-xs">
              {steps.length === 0 && (
                <div className="flex items-center gap-2 py-0.5">
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Starting scaffold pipeline...
                  </span>
                </div>
              )}
              {steps.map((step) => (
                <div key={step.step} className="flex items-center gap-2 py-0.5">
                  {step.status === "running" ? (
                    <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  ) : (
                    <Check className="size-3 text-green-500" />
                  )}
                  <span
                    className={
                      step.status === "done"
                        ? "text-muted-foreground"
                        : "text-foreground"
                    }
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Soul streaming preview */}
          {soul && (
            <div className="border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <span className="text-xs text-muted-foreground">SOUL.md</span>
              </div>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap p-3 font-mono text-xs text-muted-foreground">
                {soul}
                <span className="animate-pulse">|</span>
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Summary phase
  return (
    <div className="flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-xl flex-col gap-6">
        {/* Success header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-10 items-center justify-center border border-green-500/20 bg-green-500/10">
            <Check className="size-5 text-green-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Agent scaffolded
          </h2>
          <p className="max-w-sm text-xs text-muted-foreground">{prompt}</p>
        </div>

        {/* Agent details card */}
        <div className="border border-border bg-card">
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Framework</span>
              <span className="border border-border px-2 py-0.5 text-xs font-medium text-foreground">
                {agent?.fork ?? "openclaw"}
              </span>
            </div>

            {agent && agent.skills.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Skills</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {agent.skills.map((skill) => (
                    <span
                      key={skill}
                      className="border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {agent && agent.channels.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Connectors
                </span>
                <span className="text-xs text-muted-foreground">
                  {agent.channels.join(", ")}
                </span>
              </div>
            )}

            {agent && agent.fileCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Files</span>
                <span className="text-xs text-muted-foreground">
                  {agent.fileCount} generated
                </span>
              </div>
            )}
          </div>

          {/* Soul preview */}
          {soul && (
            <div className="border-t border-border">
              <div className="px-4 py-2">
                <span className="text-[10px] text-muted-foreground/60">
                  SOUL.md preview
                </span>
              </div>
              <pre className="max-h-32 overflow-y-auto px-4 pb-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {soul.slice(0, 500)}
                {soul.length > 500 && "..."}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            onClick={() =>
              router.push(`/${username}/${agent?.slug}/deploy?autoRetry=true`)
            }
          >
            <Rocket className="size-4" />
            Deploy to Railway
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push(`/${username}/${agent?.slug}/editor`)}
          >
            <Pencil className="size-4" />
            Customize first
          </Button>
        </div>
      </div>
    </div>
  );
}
