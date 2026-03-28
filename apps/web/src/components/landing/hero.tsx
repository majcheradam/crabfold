"use client";

import { Button } from "@crabfold/ui/components/button";
import { ArrowRight, Terminal } from "lucide-react";
import { useState } from "react";

const EXAMPLES = [
  "A GitHub issue triager that labels and assigns incoming issues",
  "A Slack bot that summarizes daily standups every morning",
  "A docs agent that answers questions from my Notion workspace",
  "A monitoring agent that alerts me when my API latency spikes",
];

export function Hero({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-12">
        {/* Logo + tagline */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Terminal className="size-4" />
            <span className="text-xs font-medium uppercase tracking-widest">
              crabfold
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Describe your agent.
            <br />
            <span className="text-muted-foreground">We&apos;ll build it.</span>
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            One prompt to scaffold, configure, and deploy autonomous AI agents.
            No code required.
          </p>
        </div>

        {/* Prompt input */}
        <form onSubmit={handleSubmit} className="w-full">
          <div className="group relative w-full border border-border bg-card transition-colors focus-within:border-foreground/20">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (value.trim()) {
                    onSubmit(value.trim());
                  }
                }
              }}
              placeholder="Describe the agent you want to build..."
              rows={3}
              className="w-full resize-none bg-transparent px-4 pt-4 pb-14 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
            />
            <div className="absolute right-3 bottom-3">
              <Button
                type="submit"
                size="sm"
                disabled={!value.trim()}
                className="gap-1.5"
              >
                Build agent
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </div>
        </form>

        {/* Example prompts */}
        <div className="flex flex-col gap-2 self-start">
          <span className="text-xs text-muted-foreground/60">
            Try an example
          </span>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setValue(example)}
                className="border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
