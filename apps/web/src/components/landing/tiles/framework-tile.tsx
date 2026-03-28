"use client";

import { Check } from "lucide-react";

import type { Framework } from "@/lib/types";

const FRAMEWORKS: {
  id: Framework;
  name: string;
  description: string;
  tag: string;
  features: string[];
}[] = [
  {
    description:
      "Full-featured agent framework with Gateway, Brain, Memory, Skills, and Heartbeat architecture.",
    features: [
      "ReAct loop",
      "50+ channels",
      "Skill marketplace",
      "Heartbeat scheduler",
    ],
    id: "openclaw",
    name: "OpenClaw",
    tag: "recommended",
  },
  {
    description:
      "Hardened fork optimized for enterprise security, compliance, and audit logging.",
    features: [
      "SOC2 ready",
      "Audit trails",
      "Role-based access",
      "On-prem deploy",
    ],
    id: "ironclaw",
    name: "IronClaw",
    tag: "enterprise",
  },
  {
    description:
      "Lightweight fork for single-purpose agents with minimal resource footprint.",
    features: [
      "< 50MB image",
      "Single skill",
      "Fast cold start",
      "Edge deploy",
    ],
    id: "nanobot",
    name: "Nanobot",
    tag: "lightweight",
  },
];

export function FrameworkTile({
  selected,
  onSelect,
}: {
  selected: Framework;
  onSelect: (fw: Framework) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-foreground">Your Framework</h3>

      <div className="grid gap-3 sm:grid-cols-3">
        {FRAMEWORKS.map((fw) => {
          const isSelected = fw.id === selected;
          return (
            <button
              key={fw.id}
              type="button"
              onClick={() => onSelect(fw.id)}
              className={`relative flex flex-col gap-3 border p-4 text-left transition-colors ${
                isSelected
                  ? "border-foreground bg-foreground/[0.03]"
                  : "border-border hover:border-foreground/20"
              }`}
            >
              {/* Name with select indicator */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex size-4 shrink-0 items-center justify-center border ${
                    isSelected
                      ? "border-foreground bg-foreground text-background"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {isSelected && <Check className="size-2.5" strokeWidth={3} />}
                </div>
                <span className="text-sm font-medium text-foreground">
                  {fw.name}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs leading-relaxed text-muted-foreground">
                {fw.description}
              </p>

              {/* Features */}
              <div className="flex flex-col gap-1">
                {fw.features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground/70"
                  >
                    <span className="text-muted-foreground/30">›</span>
                    {feature}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
