"use client";

import { env } from "@crabfold/env/web";
import { Button } from "@crabfold/ui/components/button";
import { Check, Loader2, Terminal } from "lucide-react";
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

type Phase = "idle" | "scaffolding" | "error";

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
  const [errorMsg, setErrorMsg] = useState("");
  const started = useRef(false);

  function startScaffold(text: string) {
    setPrompt(text);
    setPhase("scaffolding");
    setSteps([]);
    setSoul("");

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
        router.push(`/${username}/${evt.data.slug}`);
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

  // Scaffolding phase
  return (
    <div className="flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-xl flex-col gap-6">
        {/* Prompt echo */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground/60">Your prompt</span>
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
