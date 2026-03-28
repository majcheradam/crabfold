import type { DeployJob, DeploySSEEvent } from "./types";

const jobs = new Map<string, DeployJob>();

/** Auto-cleanup jobs older than 30 minutes */
const JOB_TTL_MS = 30 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt.getTime() > JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
}

export function createJob(id: string, agentId: string): DeployJob {
  cleanup();
  const job: DeployJob = {
    agentId,
    createdAt: new Date(),
    events: [],
    id,
    listeners: new Set(),
    status: "running",
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): DeployJob | undefined {
  return jobs.get(id);
}

export function emitToJob(jobId: string, event: DeploySSEEvent) {
  const job = jobs.get(jobId);
  if (!job) {
    return;
  }

  job.events.push(event);

  if ("event" in event) {
    job.status = event.event === "complete" ? "complete" : "error";
  }

  for (const listener of job.listeners) {
    listener(event);
  }
}

export function subscribeToJob(
  jobId: string,
  listener: (event: DeploySSEEvent) => void
): (() => void) | null {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }

  for (const event of job.events) {
    listener(event);
  }

  if (job.status !== "running") {
    return () => {
      /* noop — job already finished */
    };
  }

  job.listeners.add(listener);
  return () => {
    job.listeners.delete(listener);
  };
}
