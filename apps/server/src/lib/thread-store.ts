import type { ThreadHistory, ThreadSummary } from "./thread-types";

// ── Fork adapter interface ──────────────────────────────────────

export interface ThreadStoreAdapter {
  listThreads(
    deploymentUrl: string,
    options: { limit: number; sort: string }
  ): Promise<ThreadSummary[]>;

  getHistory(
    deploymentUrl: string,
    threadId: string,
    options: { limit: number }
  ): Promise<ThreadHistory | null>;
}

// ── Shared fetch helpers ────────────────────────────────────────

async function fetchThreads(
  deploymentUrl: string,
  options: { limit: number; sort: string }
): Promise<ThreadSummary[]> {
  const res = await fetch(
    `${deploymentUrl}/api/threads?limit=${options.limit}&sort=${options.sort}`
  );
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as { threads: ThreadSummary[] };
  return data.threads;
}

async function fetchHistory(
  deploymentUrl: string,
  threadId: string,
  options: { limit: number }
): Promise<ThreadHistory | null> {
  const res = await fetch(
    `${deploymentUrl}/api/threads/${threadId}?limit=${options.limit}`
  );
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as ThreadHistory;
}

// ── Adapter implementations ─────────────────────────────────────
// All forks currently proxy to the deployed agent's API.
// In production, each adapter may have fork-specific logic:
// - Openclaw: glob threads/*.md, parse frontmatter
// - Nanobot: read memory/threads.json
// - Ironclaw: SQL-backed threads

function createAdapter(): ThreadStoreAdapter {
  return {
    getHistory: fetchHistory,
    listThreads: fetchThreads,
  };
}

// Named exports for backward compatibility with tests
export const OpenclawThreadStore = class implements ThreadStoreAdapter {
  listThreads = fetchThreads;
  getHistory = fetchHistory;
};

export const NanobotThreadStore = OpenclawThreadStore;
export const IronclawThreadStore = OpenclawThreadStore;

// ── Factory ─────────────────────────────────────────────────────

export function createThreadStore(
  _fork: "openclaw" | "nanobot" | "ironclaw"
): ThreadStoreAdapter {
  return createAdapter();
}
