"use client";

import { MessageSquare } from "lucide-react";

const MOCK_THREADS = [
  {
    id: "t_1",
    lastActive: "3 min ago",
    messages: 8,
    title: "Triage: Memory leak in auth service",
  },
  {
    id: "t_2",
    lastActive: "1 hour ago",
    messages: 4,
    title: "Triage: Add dark mode support",
  },
  {
    id: "t_3",
    lastActive: "2 hours ago",
    messages: 12,
    title: "Triage: CI pipeline failing on main",
  },
];

export default function ThreadsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Threads</h2>
      <div className="flex flex-col divide-y divide-border border border-border">
        {MOCK_THREADS.map((thread) => (
          <div
            key={thread.id}
            className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-foreground/[0.02]"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="size-3.5 text-muted-foreground" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">
                  {thread.title}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {thread.messages} messages
                </span>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {thread.lastActive}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
