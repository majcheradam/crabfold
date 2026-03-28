"use client";

import { useState } from "react";

import { AgentCustomize } from "@/components/landing/agent-customize";
import { AgentResult } from "@/components/landing/agent-result";
import { AgentWorking } from "@/components/landing/agent-working";
import { Hero } from "@/components/landing/hero";

export type AppState = "idle" | "working" | "done" | "customize";

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (value: string) => {
    setPrompt(value);
    setState("working");

    // Mock: simulate agent working for ~4 seconds
    setTimeout(() => {
      setState("done");
    }, 4000);
  };

  const handleRebuild = () => {
    setState("working");
    setTimeout(() => {
      setState("done");
    }, 4000);
  };

  return (
    <main className="relative min-h-svh bg-background">
      {state === "idle" && <Hero onSubmit={handleSubmit} />}
      {state === "working" && <AgentWorking prompt={prompt} />}
      {state === "done" && (
        <AgentResult
          prompt={prompt}
          onRebuild={handleRebuild}
          onCustomize={() => setState("customize")}
        />
      )}
      {state === "customize" && (
        <AgentCustomize prompt={prompt} onBack={() => setState("done")} />
      )}
    </main>
  );
}
