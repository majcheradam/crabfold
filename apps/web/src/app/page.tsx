"use client";

import { useState } from "react";

import { AgentResult } from "@/components/landing/agent-result";
import { AgentWorking } from "@/components/landing/agent-working";
import { Hero } from "@/components/landing/hero";

export type AppState = "idle" | "working" | "done";

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

  const handleReset = () => {
    setState("idle");
    setPrompt("");
  };

  return (
    <main className="relative min-h-svh bg-background">
      {state === "idle" && <Hero onSubmit={handleSubmit} />}
      {state === "working" && <AgentWorking prompt={prompt} />}
      {state === "done" && (
        <AgentResult prompt={prompt} onReset={handleReset} />
      )}
    </main>
  );
}
