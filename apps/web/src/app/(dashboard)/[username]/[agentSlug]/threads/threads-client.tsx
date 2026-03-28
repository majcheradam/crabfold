"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";

interface ThreadSummary {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  updatedAt: string;
}

export function ThreadsClient({
  threads,
  username,
  agentSlug,
}: {
  threads: ThreadSummary[];
  username: string;
  agentSlug: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Sessions</h2>
      {threads.length === 0 ? (
        <p className="text-xs text-muted-foreground">No sessions yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border border border-border">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/${username}/${agentSlug}/threads/${thread.id}`}
              className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-foreground/[0.02]"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-foreground">
                    {thread.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {thread.lastMessage}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {thread.updatedAt}
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  {thread.messageCount} messages
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
