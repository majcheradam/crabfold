"use client";

import type { Skill } from "@/lib/types";

export function SkillsTile({
  skills,
  onToggle,
}: {
  skills: Skill[];
  onToggle: (id: string) => void;
}) {
  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <div className="flex flex-col border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">Skills</h3>
        <span className="text-xs text-muted-foreground">
          {enabledCount}/{skills.length} active
        </span>
      </div>
      <div className="flex flex-col gap-0 p-2">
        {skills.map((skill) => (
          <button
            key={skill.id}
            type="button"
            onClick={() => onToggle(skill.id)}
            className={`flex items-start gap-3 p-3 text-left transition-colors ${
              skill.enabled ? "bg-foreground/5" : "opacity-50 hover:opacity-70"
            }`}
          >
            <div
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center border transition-colors ${
                skill.enabled
                  ? "border-foreground bg-foreground text-background"
                  : "border-muted-foreground/30"
              }`}
            >
              {skill.enabled && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className="text-background"
                >
                  <path
                    d="M2 5L4 7L8 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="square"
                  />
                </svg>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground">
                {skill.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {skill.description}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
