"use client";

import { Terminal, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const MOCK_STEPS = [
  { delay: 0, label: "Analyzing prompt..." },
  { delay: 600, label: "Selecting agent framework: openclaw" },
  { delay: 1200, label: "Generating SKILL.md manifests" },
  { delay: 1800, label: "Configuring Gateway channels" },
  { delay: 2200, label: "Setting up Memory structure" },
  { delay: 2600, label: "Wiring Brain orchestration (ReAct loop)" },
  { delay: 3000, label: "Configuring Heartbeat scheduler" },
  { delay: 3400, label: "Validating workspace config" },
  { delay: 3800, label: "Scaffold complete" },
];

export function AgentWorking({ prompt }: { prompt: string }) {
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    const timers = MOCK_STEPS.map((step, i) =>
      setTimeout(() => setVisibleSteps(i + 1), step.delay)
    );
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, []);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-xl flex-col gap-6">
        {/* Prompt echo */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground/60">Your prompt</span>
          <p className="text-sm text-foreground">{prompt}</p>
        </div>

        {/* Terminal-style output */}
        <div className="border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Terminal className="size-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              crabfold agent builder
            </span>
          </div>
          <div className="flex flex-col gap-0 p-3 font-mono text-xs">
            {MOCK_STEPS.slice(0, visibleSteps).map((step, i) => {
              const isLast = i === visibleSteps - 1;
              const isDone = i === MOCK_STEPS.length - 1;
              const isLoading = isLast && visibleSteps < MOCK_STEPS.length;

              let icon: React.ReactNode;
              if (isDone) {
                icon = <span className="text-green-500">✓</span>;
              } else if (isLoading) {
                icon = (
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                );
              } else {
                icon = <span className="text-muted-foreground/40">›</span>;
              }

              let textClass: string;
              if (isDone) {
                textClass = "text-green-500";
              } else if (isLoading) {
                textClass = "text-foreground";
              } else {
                textClass = "text-muted-foreground";
              }

              return (
                <div
                  key={step.label}
                  className="flex items-center gap-2 py-0.5"
                >
                  {icon}
                  <span className={textClass}>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
