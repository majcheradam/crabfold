"use client";

import { Button } from "@crabfold/ui/components/button";
import { ArrowRight, Mic, MicOff, Terminal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { AudioVisualizer } from "@/components/audio-visualizer";
import { useVoiceInput } from "@/hooks/use-voice-input";

const EXAMPLES = [
  "A GitHub issue triager that labels and assigns incoming issues",
  "A Slack bot that summarizes daily standups every morning",
  "A docs agent that answers questions from my Notion workspace",
  "A monitoring agent that alerts me when my API latency spikes",
];

export default function Home() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const handleVoiceResult = useCallback(
    (text: string) => setValue((prev) => (prev ? `${prev} ${text}` : text)),
    []
  );
  const {
    recording,
    stream,
    toggle: toggleVoice,
  } = useVoiceInput(handleVoiceResult);

  const handleSubmit = (input: string) => {
    if (!input.trim()) {
      return;
    }
    router.push(`/new?prompt=${encodeURIComponent(input.trim())}`);
  };

  return (
    <div className="flex min-h-svh flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Terminal className="size-4" />
          <span className="text-xs font-medium uppercase tracking-widest">
            crabfold
          </span>
        </div>
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </Link>
      </header>

      {/* Hero + prompt */}
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-2xl flex-col items-center gap-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Describe your agent.
              <br />
              <span className="text-muted-foreground">
                We&apos;ll build it.
              </span>
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              One prompt to scaffold, configure, and deploy autonomous AI
              agents. No code required.
            </p>
          </div>

          {/* Prompt input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(value);
            }}
            className="w-full"
          >
            <div className="group relative w-full border border-border bg-card transition-colors focus-within:border-foreground/20">
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(value);
                  }
                }}
                placeholder="Describe the agent you want to build..."
                rows={3}
                className="w-full resize-none bg-transparent px-4 pt-4 pb-14 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
                {recording && <AudioVisualizer stream={stream} />}
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`flex size-7 items-center justify-center border transition-colors ${
                    recording
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {recording ? (
                    <MicOff className="size-3" />
                  ) : (
                    <Mic className="size-3" />
                  )}
                </button>
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

          {/* Examples */}
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
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center px-6 py-6">
        <p className="text-xs text-muted-foreground/50">
          Open source. Supports OpenClaw, IronClaw, and Nanobot.
        </p>
      </footer>
    </div>
  );
}
