import { randomUUIDv7 } from "bun";

export interface JobEvent {
  data: Record<string, unknown>;
  event?: string;
  step?: string;
  status?: "done" | "error" | "running";
  label?: string;
}

interface Job {
  id: string;
  events: JobEvent[];
  listeners: Set<(event: JobEvent) => void>;
  done: boolean;
}

const jobs = new Map<string, Job>();

export function createJob(): string {
  const id = randomUUIDv7();
  jobs.set(id, { done: false, events: [], id, listeners: new Set() });
  return id;
}

export function emitJobEvent(jobId: string, event: JobEvent): void {
  const job = jobs.get(jobId);
  if (!job) {
    return;
  }

  job.events.push(event);
  for (const listener of job.listeners) {
    listener(event);
  }

  if (event.event === "complete" || event.event === "error") {
    job.done = true;
    // Clean up after 5 minutes
    setTimeout(() => jobs.delete(jobId), 5 * 60 * 1000);
  }
}

export function subscribeToJob(
  jobId: string,
  listener: (event: JobEvent) => void
): (() => void) | null {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }

  // Replay past events
  for (const event of job.events) {
    listener(event);
  }

  if (job.done) {
    // eslint-disable-next-line no-empty-function -- noop for already-done jobs
    return () => {};
  }

  job.listeners.add(listener);
  return () => job.listeners.delete(listener);
}
