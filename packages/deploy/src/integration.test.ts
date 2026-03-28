import { describe, expect, mock, test } from "bun:test";

import type { DeployDeps } from "./deploy-service";
import { deployToRailway } from "./deploy-service";
import { createJob, emitToJob, getJob, subscribeToJob } from "./jobs";
import type {
  DeployCompleteEvent,
  DeployConfig,
  DeployErrorEvent,
  DeployEvent,
  DeploySSEEvent,
  DeployTokens,
} from "./types";

function createMockDeps(overrides?: {
  db?: Partial<DeployDeps["db"]>;
  github?: Partial<DeployDeps["github"]>;
  railway?: Partial<DeployDeps["railway"]>;
}): DeployDeps {
  return {
    db: {
      updateAgent: mock(() => Promise.resolve()),
      ...overrides?.db,
    },
    github: {
      createRepo: mock(() =>
        Promise.resolve({
          defaultBranch: "main",
          fullName: "testuser/crabfold-test-agent",
          repoUrl: "https://github.com/testuser/crabfold-test-agent",
        })
      ),
      pushFiles: mock(() => Promise.resolve({ commitSha: "int-sha" })),
      ...overrides?.github,
    },
    pollIntervalMs: 0,
    railway: {
      createDomain: mock(() =>
        Promise.resolve({ domain: "test-agent-production.up.railway.app" })
      ),
      createProject: mock(() =>
        Promise.resolve({ environmentId: "env-int", projectId: "proj-int" })
      ),
      createService: mock(() => Promise.resolve({ serviceId: "svc-int" })),
      createServiceFromImage: mock(() =>
        Promise.resolve({ serviceId: "svc-db-int" })
      ),
      createVolume: mock(() => Promise.resolve({ volumeId: "vol-int" })),
      getDeploymentStatus: mock(() =>
        Promise.resolve({ status: "SUCCESS" as const })
      ),
      getServiceDomains: mock(() => Promise.resolve([])),
      triggerDeploy: mock(() =>
        Promise.resolve({ deploymentId: "deploy-int" })
      ),
      upsertVariables: mock(() => Promise.resolve()),
      ...overrides?.railway,
    },
  };
}

const config: DeployConfig = {
  agentId: "agent-int-1",
  agentName: "Test Agent",
  agentSlug: "test-agent",
  envVars: { SLACK_TOKEN: "xoxb-test" },
  files: [
    { content: "export default { run() {} }", path: "index.ts" },
    { content: '{"fork":"openclaw"}', path: "config.json" },
  ],
  fork: "openclaw",
  skills: ["slack-notify"],
};

const tokens: DeployTokens = {
  githubToken: "ghp-int-token",
  railwayToken: "rw-int-token",
};

describe("integration: deploy pipeline", () => {
  test("full deploy flow via job store matches sequence diagram", async () => {
    const deps = createMockDeps();

    const jobId = `job-${crypto.randomUUID()}`;
    createJob(jobId, config.agentId);

    const deployPromise = deployToRailway(
      config,
      tokens,
      (event) => emitToJob(jobId, event),
      deps
    );

    const sseEvents: DeploySSEEvent[] = [];
    const unsubscribe = subscribeToJob(jobId, (event) => {
      sseEvents.push(event);
    });
    expect(unsubscribe).not.toBeNull();

    await deployPromise;
    unsubscribe?.();

    const job = getJob(jobId);
    expect(job?.status).toBe("complete");

    const stepDoneEvents = sseEvents.filter(
      (e): e is DeployEvent =>
        "step" in e && "status" in e && e.status === "done"
    );
    expect(stepDoneEvents.map((e) => e.step)).toEqual([
      "prepare",
      "repo",
      "project",
      "service",
      "env_vars",
      "storage",
    ]);

    const deployingEvents = sseEvents.filter(
      (e): e is DeployEvent => "step" in e && e.step === "deploying"
    );
    const domainEvent = deployingEvents.find((e) => e.domain);
    expect(domainEvent).toBeDefined();
    expect(domainEvent?.domain).toBe("test-agent-production.up.railway.app");

    const completeEvent = sseEvents.find(
      (e): e is DeployCompleteEvent => "event" in e && e.event === "complete"
    );
    expect(completeEvent?.url).toBe(
      "https://test-agent-production.up.railway.app"
    );
    expect(completeEvent?.railwayProjectId).toBe("proj-int");

    expect(job?.events).toEqual(sseEvents);
  });

  test("late subscriber receives replayed events then live updates", async () => {
    const deps = createMockDeps();
    let pollCount = 0;
    deps.railway.getDeploymentStatus = mock(() => {
      pollCount += 1;
      if (pollCount <= 2) {
        return Promise.resolve({ status: "BUILDING" as const });
      }
      return Promise.resolve({ status: "SUCCESS" as const });
    });

    const jobId = `job-late-${crypto.randomUUID()}`;
    createJob(jobId, config.agentId);

    await deployToRailway(
      config,
      tokens,
      (event) => emitToJob(jobId, event),
      deps
    );

    const lateEvents: DeploySSEEvent[] = [];
    const unsub = subscribeToJob(jobId, (event) => lateEvents.push(event));

    expect(lateEvents.length).toBeGreaterThan(0);

    const completeEvent = lateEvents.find(
      (e): e is DeployCompleteEvent => "event" in e && e.event === "complete"
    );
    expect(completeEvent).toBeDefined();
    expect(completeEvent?.url).toBe(
      "https://test-agent-production.up.railway.app"
    );

    unsub?.();
  });

  test("error during GitHub repo creation propagates through job store", async () => {
    const deps = createMockDeps({
      github: {
        createRepo: mock(() =>
          Promise.reject(new Error("Repository name already exists"))
        ),
      },
    });

    const jobId = `job-err-${crypto.randomUUID()}`;
    createJob(jobId, config.agentId);

    const sseEvents: DeploySSEEvent[] = [];
    subscribeToJob(jobId, (event) => sseEvents.push(event));

    await deployToRailway(
      config,
      tokens,
      (event) => emitToJob(jobId, event),
      deps
    );

    const job = getJob(jobId);
    expect(job?.status).toBe("error");

    const errorEvent = sseEvents.find(
      (e): e is DeployErrorEvent => "event" in e && e.event === "error"
    );
    expect(errorEvent?.message).toBe("Repository name already exists");

    const dbMock = deps.db.updateAgent as ReturnType<typeof mock>;
    expect(dbMock).toHaveBeenCalledWith("agent-int-1", { status: "error" });
  });

  test("error during Railway service creation stops pipeline", async () => {
    const deps = createMockDeps({
      railway: {
        createService: mock(() =>
          Promise.reject(new Error("Insufficient Railway credits"))
        ),
      },
    });

    const jobId = `job-rw-err-${crypto.randomUUID()}`;
    createJob(jobId, config.agentId);

    const sseEvents: DeploySSEEvent[] = [];
    subscribeToJob(jobId, (event) => sseEvents.push(event));

    await deployToRailway(
      config,
      tokens,
      (event) => emitToJob(jobId, event),
      deps
    );

    const job = getJob(jobId);
    expect(job?.status).toBe("error");

    const doneSteps = sseEvents
      .filter(
        (e): e is DeployEvent =>
          "step" in e && "status" in e && e.status === "done"
      )
      .map((e) => e.step);
    expect(doneSteps).toEqual(["prepare", "repo", "project"]);
    expect(doneSteps).not.toContain("env_vars");
    expect(doneSteps).not.toContain("storage");
  });

  test("ironclaw fork creates postgres instead of volume", async () => {
    const deps = createMockDeps();

    const jobId = `job-ironclaw-${crypto.randomUUID()}`;
    createJob(jobId, config.agentId);

    await deployToRailway(
      { ...config, fork: "ironclaw" },
      tokens,
      (event) => emitToJob(jobId, event),
      deps
    );

    const job = getJob(jobId);
    expect(job?.status).toBe("complete");

    expect(deps.railway.createServiceFromImage).toHaveBeenCalledWith(
      "rw-int-token",
      "proj-int",
      "postgres:16-alpine"
    );
    expect(deps.railway.createVolume).not.toHaveBeenCalled();
  });

  test("deploy with CRASHED status emits error", async () => {
    const deps = createMockDeps({
      railway: {
        getDeploymentStatus: mock(() =>
          Promise.resolve({ status: "CRASHED" as const })
        ),
      },
    });

    const jobId = `job-crash-${crypto.randomUUID()}`;
    createJob(jobId, config.agentId);

    const sseEvents: DeploySSEEvent[] = [];
    subscribeToJob(jobId, (event) => sseEvents.push(event));

    await deployToRailway(
      config,
      tokens,
      (event) => emitToJob(jobId, event),
      deps
    );

    const job = getJob(jobId);
    expect(job?.status).toBe("error");

    const errorEvent = sseEvents.find(
      (e): e is DeployErrorEvent => "event" in e && e.event === "error"
    );
    expect(errorEvent?.message).toContain("CRASHED");
  });

  test("SSE event format matches expected wire format", async () => {
    const deps = createMockDeps();

    const jobId = `job-format-${crypto.randomUUID()}`;
    createJob(jobId, config.agentId);

    const sseEvents: DeploySSEEvent[] = [];
    subscribeToJob(jobId, (event) => sseEvents.push(event));

    await deployToRailway(
      config,
      tokens,
      (event) => emitToJob(jobId, event),
      deps
    );

    for (const event of sseEvents) {
      const serialized = JSON.stringify(event);
      const parsed = JSON.parse(serialized) as DeploySSEEvent;

      if ("step" in event && "step" in parsed) {
        expect(parsed.step).toBe(event.step);
      }
      if ("event" in event && "event" in parsed) {
        expect(parsed.event).toBe(event.event);
      }
    }

    const prepareRunning = sseEvents[0] as DeployEvent;
    expect(prepareRunning.step).toBe("prepare");
    expect(prepareRunning.status).toBe("running");
    expect(prepareRunning.message).toBeDefined();

    const prepareDone = sseEvents[1] as DeployEvent;
    expect(prepareDone.step).toBe("prepare");
    expect(prepareDone.status).toBe("done");

    const complete = sseEvents.at(-1) as DeployCompleteEvent;
    expect(complete.event).toBe("complete");
    expect(complete.url).toMatch(/^https:\/\//);
    expect(complete.railwayProjectId).toBeTruthy();
  });

  test("multiple concurrent deploys don't interfere", async () => {
    const deps1 = createMockDeps({
      railway: {
        createDomain: mock(() =>
          Promise.resolve({ domain: "agent-a.up.railway.app" })
        ),
        createProject: mock(() =>
          Promise.resolve({ environmentId: "env-A", projectId: "proj-A" })
        ),
      },
    });

    const deps2 = createMockDeps({
      railway: {
        createDomain: mock(() =>
          Promise.resolve({ domain: "agent-b.up.railway.app" })
        ),
        createProject: mock(() =>
          Promise.resolve({ environmentId: "env-B", projectId: "proj-B" })
        ),
      },
    });

    const jobId1 = `job-concurrent-1-${crypto.randomUUID()}`;
    const jobId2 = `job-concurrent-2-${crypto.randomUUID()}`;
    createJob(jobId1, "agent-A");
    createJob(jobId2, "agent-B");

    const events1: DeploySSEEvent[] = [];
    const events2: DeploySSEEvent[] = [];
    subscribeToJob(jobId1, (e) => events1.push(e));
    subscribeToJob(jobId2, (e) => events2.push(e));

    await Promise.all([
      deployToRailway(
        { ...config, agentId: "agent-A", agentSlug: "agent-a" },
        tokens,
        (event) => emitToJob(jobId1, event),
        deps1
      ),
      deployToRailway(
        { ...config, agentId: "agent-B", agentSlug: "agent-b" },
        tokens,
        (event) => emitToJob(jobId2, event),
        deps2
      ),
    ]);

    expect(getJob(jobId1)?.status).toBe("complete");
    expect(getJob(jobId2)?.status).toBe("complete");

    const complete1 = events1.find(
      (e): e is DeployCompleteEvent => "event" in e && e.event === "complete"
    );
    const complete2 = events2.find(
      (e): e is DeployCompleteEvent => "event" in e && e.event === "complete"
    );

    expect(complete1?.url).toBe("https://agent-a.up.railway.app");
    expect(complete2?.url).toBe("https://agent-b.up.railway.app");
    expect(complete1?.railwayProjectId).toBe("proj-A");
    expect(complete2?.railwayProjectId).toBe("proj-B");
  });
});
