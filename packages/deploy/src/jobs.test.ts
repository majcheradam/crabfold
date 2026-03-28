import { describe, expect, test } from "bun:test";

import { createJob, emitToJob, getJob, subscribeToJob } from "./jobs";
import type { DeploySSEEvent } from "./types";

describe("jobs", () => {
  test("createJob creates a job and getJob retrieves it", () => {
    const job = createJob("job-1", "agent-1");
    expect(job.id).toBe("job-1");
    expect(job.agentId).toBe("agent-1");
    expect(job.status).toBe("running");
    expect(job.events).toEqual([]);

    const retrieved = getJob("job-1");
    expect(retrieved).toBe(job);
  });

  test("getJob returns undefined for unknown job", () => {
    expect(getJob("nonexistent")).toBeUndefined();
  });

  test("emitToJob pushes events and notifies listeners", () => {
    createJob("job-2", "agent-2");
    const received: DeploySSEEvent[] = [];

    subscribeToJob("job-2", (event) => received.push(event));

    const event: DeploySSEEvent = { status: "done", step: "prepare" };
    emitToJob("job-2", event);

    const job = getJob("job-2");
    expect(job?.events).toHaveLength(1);
    expect(job?.events[0]).toEqual(event);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(event);
  });

  test("emitToJob marks job complete on complete event", () => {
    createJob("job-3", "agent-3");
    emitToJob("job-3", {
      event: "complete",
      railwayProjectId: "proj-1",
      url: "https://test.up.railway.app",
    });

    const job = getJob("job-3");
    expect(job?.status).toBe("complete");
  });

  test("emitToJob marks job error on error event", () => {
    createJob("job-4", "agent-4");
    emitToJob("job-4", {
      event: "error",
      message: "GitHub API failed",
      step: "repo",
    });

    const job = getJob("job-4");
    expect(job?.status).toBe("error");
  });

  test("subscribeToJob replays existing events", () => {
    createJob("job-5", "agent-5");
    emitToJob("job-5", { status: "done", step: "prepare" });
    emitToJob("job-5", { status: "running", step: "repo" });

    const received: DeploySSEEvent[] = [];
    subscribeToJob("job-5", (event) => received.push(event));

    expect(received).toHaveLength(2);
    expect(received[0]).toEqual({ status: "done", step: "prepare" });
    expect(received[1]).toEqual({ status: "running", step: "repo" });
  });

  test("subscribeToJob returns null for unknown job", () => {
    const unsub = subscribeToJob("nonexistent", () => {
      /* noop */
    });
    expect(unsub).toBeNull();
  });

  test("unsubscribe stops receiving events", () => {
    createJob("job-6", "agent-6");
    const received: DeploySSEEvent[] = [];

    const unsub = subscribeToJob("job-6", (event) => received.push(event));
    emitToJob("job-6", { status: "done", step: "prepare" });
    expect(received).toHaveLength(1);

    unsub?.();
    emitToJob("job-6", { status: "done", step: "repo" });
    expect(received).toHaveLength(1);
  });

  test("emitToJob is a no-op for unknown job", () => {
    emitToJob("nonexistent", { status: "done", step: "prepare" });
  });
});
