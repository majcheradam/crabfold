import { describe, expect, mock, test } from "bun:test";

import type { DeployDeps } from "./deploy-service";
import { deployToRailway } from "./deploy-service";
import type {
  DeployConfig,
  DeployEvent,
  DeploySSEEvent,
  DeployTokens,
} from "./types";

function createMockDeps(overrides?: Partial<DeployDeps>): DeployDeps {
  return {
    db: {
      updateAgent: mock(() => Promise.resolve()),
      ...overrides?.db,
    },
    github: {
      createRepo: mock(() =>
        Promise.resolve({
          defaultBranch: "main",
          fullName: "user/crabfold-my-agent",
          repoUrl: "https://github.com/user/crabfold-my-agent",
        })
      ),
      pushFiles: mock(() => Promise.resolve({ commitSha: "abc123" })),
      ...overrides?.github,
    },
    pollIntervalMs: 0,
    railway: {
      createDomain: mock(() =>
        Promise.resolve({ domain: "my-agent-production.up.railway.app" })
      ),
      createProject: mock(() =>
        Promise.resolve({ environmentId: "env-1", projectId: "proj-1" })
      ),
      createService: mock(() => Promise.resolve({ serviceId: "svc-1" })),
      createServiceFromImage: mock(() =>
        Promise.resolve({ serviceId: "svc-db" })
      ),
      createVolume: mock(() => Promise.resolve({ volumeId: "vol-1" })),
      getDeploymentStatus: mock(() =>
        Promise.resolve({ status: "SUCCESS" as const })
      ),
      triggerDeploy: mock(() => Promise.resolve({ deploymentId: "deploy-1" })),
      upsertVariables: mock(() => Promise.resolve()),
      ...overrides?.railway,
    },
  };
}

const baseConfig: DeployConfig = {
  agentId: "agent-1",
  agentName: "My Agent",
  agentSlug: "my-agent",
  envVars: { API_KEY: "sk-test" },
  files: [
    { content: 'console.log("hello")', path: "index.ts" },
    { content: '{"name":"agent"}', path: "package.json" },
  ],
  fork: "openclaw",
  skills: ["github-triage"],
};

const tokens: DeployTokens = {
  githubToken: "ghp-token",
  railwayToken: "rw-token",
};

describe("deployToRailway", () => {
  test("emits all steps in correct order for openclaw fork", async () => {
    const deps = createMockDeps();
    const events: DeploySSEEvent[] = [];
    await deployToRailway(baseConfig, tokens, (e) => events.push(e), deps);

    const steps = events
      .filter(
        (e): e is DeployEvent =>
          "step" in e && "status" in e && e.status === "done"
      )
      .map((e) => e.step);

    expect(steps).toEqual([
      "prepare",
      "repo",
      "project",
      "service",
      "env_vars",
      "storage",
    ]);

    const last = events.at(-1);
    expect(last && "event" in last && last.event).toBe("complete");
    if (last && "url" in last) {
      expect(last.url).toBe("https://my-agent-production.up.railway.app");
    }
  });

  test("creates volume for openclaw fork", async () => {
    const deps = createMockDeps();
    const events: DeploySSEEvent[] = [];
    await deployToRailway(baseConfig, tokens, (e) => events.push(e), deps);

    expect(deps.railway.createVolume).toHaveBeenCalledTimes(1);
    expect(deps.railway.createServiceFromImage).not.toHaveBeenCalled();
  });

  test("creates volume for nanobot fork", async () => {
    const deps = createMockDeps();
    const events: DeploySSEEvent[] = [];
    await deployToRailway(
      { ...baseConfig, fork: "nanobot" },
      tokens,
      (e) => events.push(e),
      deps
    );

    expect(deps.railway.createVolume).toHaveBeenCalledTimes(1);
    expect(deps.railway.createServiceFromImage).not.toHaveBeenCalled();
  });

  test("creates postgres service for ironclaw fork", async () => {
    const deps = createMockDeps();
    const events: DeploySSEEvent[] = [];
    await deployToRailway(
      { ...baseConfig, fork: "ironclaw" },
      tokens,
      (e) => events.push(e),
      deps
    );

    expect(deps.railway.createServiceFromImage).toHaveBeenCalledWith(
      "rw-token",
      "proj-1",
      "postgres:16-alpine"
    );
    expect(deps.railway.createVolume).not.toHaveBeenCalled();
  });

  test("injects OTel env file into pushed files", async () => {
    const deps = createMockDeps();
    const events: DeploySSEEvent[] = [];
    await deployToRailway(baseConfig, tokens, (e) => events.push(e), deps);

    const pushMock = deps.github.pushFiles as ReturnType<typeof mock>;
    const [pushCall] = pushMock.mock.calls;
    const files = pushCall?.[3] as
      | { content: string; path: string }[]
      | undefined;
    const otelFile = files?.find((f) => f.path === ".env.otel");

    expect(otelFile).toBeDefined();
    expect(otelFile?.content).toContain("OTEL_SERVICE_NAME=crabfold-my-agent");
    expect(otelFile?.content).toContain("agent.id=agent-1");
  });

  test("passes env vars to Railway with OTel additions", async () => {
    const deps = createMockDeps();
    const events: DeploySSEEvent[] = [];
    await deployToRailway(baseConfig, tokens, (e) => events.push(e), deps);

    const upsertMock = deps.railway.upsertVariables as ReturnType<typeof mock>;
    const [upsertCall] = upsertMock.mock.calls;
    const vars = upsertCall?.[4] as Record<string, string> | undefined;

    expect(vars?.API_KEY).toBe("sk-test");
    expect(vars?.OTEL_EXPORTER_OTLP_ENDPOINT).toBeDefined();
    expect(vars?.OTEL_SERVICE_NAME).toBe("crabfold-my-agent");
  });

  test("updates database on success", async () => {
    const deps = createMockDeps();
    const events: DeploySSEEvent[] = [];
    await deployToRailway(baseConfig, tokens, (e) => events.push(e), deps);

    const updateMock = deps.db.updateAgent as ReturnType<typeof mock>;
    expect(updateMock).toHaveBeenCalledWith("agent-1", {
      deploymentUrl: "https://my-agent-production.up.railway.app",
      railwayProjectId: "proj-1",
      status: "live",
    });
  });

  test("emits error event and sets DB status on failure", async () => {
    const deps = createMockDeps({
      railway: {
        createProject: mock(() => Promise.reject(new Error("Railway is down"))),
      } as unknown as DeployDeps["railway"],
    });

    const events: DeploySSEEvent[] = [];
    await deployToRailway(baseConfig, tokens, (e) => events.push(e), deps);

    const last = events.at(-1);
    expect(last && "event" in last && last.event).toBe("error");
    if (last && "message" in last) {
      expect(last.message).toBe("Railway is down");
    }

    const updateMock = deps.db.updateAgent as ReturnType<typeof mock>;
    expect(updateMock).toHaveBeenCalledWith("agent-1", { status: "error" });
  });

  test("emits deploying step with domain during polling", async () => {
    let pollCount = 0;
    const deps = createMockDeps({
      railway: {
        getDeploymentStatus: mock(() => {
          pollCount += 1;
          if (pollCount < 2) {
            return Promise.resolve({ status: "BUILDING" as const });
          }
          return Promise.resolve({ status: "SUCCESS" as const });
        }),
      } as unknown as DeployDeps["railway"],
    });

    const events: DeploySSEEvent[] = [];
    await deployToRailway(baseConfig, tokens, (e) => events.push(e), deps);

    const deployingEvents = events.filter(
      (e) => "step" in e && e.step === "deploying"
    );
    const withBuildStatus = deployingEvents.filter(
      (e) => "buildStatus" in e && e.buildStatus
    );

    expect(withBuildStatus.length).toBeGreaterThanOrEqual(1);
    const buildingEvent = withBuildStatus.find(
      (e) => "buildStatus" in e && e.buildStatus === "BUILDING"
    );
    expect(buildingEvent).toBeDefined();
  });

  test("emits error when deployment fails with FAILED status", async () => {
    const deps = createMockDeps({
      railway: {
        getDeploymentStatus: mock(() =>
          Promise.resolve({ status: "FAILED" as const })
        ),
      } as unknown as DeployDeps["railway"],
    });

    const events: DeploySSEEvent[] = [];
    await deployToRailway(baseConfig, tokens, (e) => events.push(e), deps);

    const last = events.at(-1);
    expect(last && "event" in last && last.event).toBe("error");
    if (last && "message" in last) {
      expect(last.message).toContain("FAILED");
    }
  });
});
