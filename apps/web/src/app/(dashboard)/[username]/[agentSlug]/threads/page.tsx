"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const MOCK_THREADS = [
  {
    id: "t_1",
    lastActive: "3 min ago",
    messages: 8,
    preview:
      "Classified as bug, applied label priority/high, assigned to @alice",
    title: "Triage: Memory leak in auth service",
  },
  {
    id: "t_2",
    lastActive: "1 hour ago",
    messages: 4,
    preview:
      "Classified as feature, applied label enhancement, assigned to @bob",
    title: "Triage: Add dark mode support",
  },
  {
    id: "t_3",
    lastActive: "2 hours ago",
    messages: 12,
    preview: "Investigating CI failure on main branch, checking recent commits",
    title: "Triage: CI pipeline failing on main",
  },
];

export default function ThreadsPage() {
  const params = useParams<{ username: string; agentSlug: string }>();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Sessions</h2>
      <div className="flex flex-col divide-y divide-border border border-border">
        {MOCK_THREADS.map((thread) => (
          <Link
            key={thread.id}
            href={`/${params.username}/${params.agentSlug}/threads/${thread.id}`}
            className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-foreground/[0.02]"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">
                  {thread.title}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {thread.preview}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-[10px] text-muted-foreground">
                {thread.lastActive}
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                {thread.messages} messages
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
