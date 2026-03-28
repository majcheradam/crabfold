"use client";

import { useState } from "react";

import type { WorkspaceFile } from "@/lib/types";

export function WorkspaceTile({
  files,
  onUpdateFile,
}: {
  files: WorkspaceFile[];
  onUpdateFile: (name: string, content: string) => void;
}) {
  const [activeFile, setActiveFile] = useState(files[0]?.name ?? "");
  const [editing, setEditing] = useState(false);
  const current = files.find((f) => f.name === activeFile);

  return (
    <div className="flex min-w-0 flex-col overflow-hidden border border-border">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">Workspace Files</h3>
        <p className="text-xs text-muted-foreground">
          Review and edit generated config files
        </p>
      </div>

      {/* File tabs */}
      <div className="flex border-b border-border">
        {files.map((file) => (
          <button
            key={file.name}
            type="button"
            onClick={() => {
              setActiveFile(file.name);
              setEditing(false);
            }}
            className={`px-4 py-2 font-mono text-xs transition-colors ${
              file.name === activeFile
                ? "bg-foreground/5 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {file.name}
          </button>
        ))}
      </div>

      {/* File content */}
      {current && (
        <div className="relative min-w-0 overflow-hidden">
          {editing ? (
            <textarea
              value={current.content}
              onChange={(e) => onUpdateFile(current.name, e.target.value)}
              spellCheck={false}
              className="min-h-[280px] w-full resize-y bg-transparent p-4 font-mono text-xs leading-relaxed text-foreground outline-none"
            />
          ) : (
            <pre className="min-h-[280px] max-w-full overflow-x-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {current.content}
            </pre>
          )}
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="absolute top-3 right-3 border border-border bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      )}
    </div>
  );
}
