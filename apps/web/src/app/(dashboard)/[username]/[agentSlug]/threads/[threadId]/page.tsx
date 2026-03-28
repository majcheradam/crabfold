"use client";

import { useParams } from "next/navigation";

export default function ThreadDetailPage() {
  const params = useParams<{ threadId: string }>();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">
        Thread {params.threadId}
      </h2>
      <div className="flex flex-col items-center justify-center border border-border py-20 text-xs text-muted-foreground">
        Live thread view with inject input will appear here
      </div>
    </div>
  );
}
