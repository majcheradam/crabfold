"use client";

import { Button } from "@crabfold/ui/components/button";
import { ArrowRight, Mic, MicOff } from "lucide-react";
import { useCallback, useState } from "react";

import { AudioVisualizer } from "@/components/audio-visualizer";
import { useVoiceInput } from "@/hooks/use-voice-input";

const TEMPLATES = [
  {
    description:
      "Full-featured agent framework with Gateway, Brain, Memory, Skills, and Heartbeat architecture.",
    features: ["ReAct loop", "50+ channels", "Skill marketplace"],
    framework: "openclaw" as const,
    image: "/openclaw.svg",
    name: "OpenClaw",
    prompt: "A full-featured autonomous agent using the OpenClaw framework",
  },
  {
    description:
      "Lightweight fork for single-purpose agents with minimal resource footprint.",
    features: ["< 50MB image", "Fast cold start", "Edge deploy"],
    framework: "nanobot" as const,
    image: "/nanobot.png",
    name: "Nanobot",
    prompt: "A lightweight single-purpose agent using the Nanobot framework",
  },
];

export function Hero({ onSubmit }: { onSubmit: (value: string) => void }) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-4xl flex-col items-center gap-16">
        {/* Tagline */}
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl text-center">
          Describe your agent.
          <br />
          <span className="text-muted-foreground">We&apos;ll build it.</span>
        </h1>

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

        {/* Templates */}
        <div className="flex w-full flex-col gap-5">
          <span className="text-lg font-semibold text-foreground">
            Start with a template
          </span>
          <div className="grid w-full gap-4 sm:grid-cols-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.framework}
                type="button"
                onClick={() => onSubmit(tpl.prompt)}
                className="group flex flex-col overflow-hidden border border-border text-left transition-colors hover:border-foreground/20"
              >
                <div className="h-48 w-full shrink-0 bg-muted">
                  <img
                    src={tpl.image}
                    alt={tpl.name}
                    className="size-full object-contain p-6"
                  />
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <span className="text-sm font-medium text-foreground">
                    {tpl.name}
                  </span>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {tpl.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {tpl.features.map((f) => (
                      <span
                        key={f}
                        className="border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground/70"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
