import * as defaultGithub from "./github";
import * as defaultRailway from "./railway";
import type { DeployConfig, DeployTokens, EmitFn } from "./types";

function sleep(ms: number): Promise<void> {
  return Bun.sleep(ms);
}

const OTEL_COLLECTOR_ENDPOINT = "https://otel.crabfold.dev/v1/traces";
const DEFAULT_POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

export interface DeployDeps {
  db: {
    updateAgent: (
      id: string,
      data: {
        deploymentUrl?: string;
        railwayProjectId?: string;
        status: "draft" | "deploying" | "live" | "error";
      }
    ) => Promise<void>;
  };
  github: typeof defaultGithub;
  pollIntervalMs?: number;
  railway: typeof defaultRailway;
}

/**
 * Create default deps with real Railway/GitHub clients and database.
 * Lazily imports @crabfold/db to avoid env validation at import time.
 */
export async function createDefaultDeps(): Promise<DeployDeps> {
  const { db, eq } = await import("@crabfold/db");
  const { agent } = await import("@crabfold/db/schema/agent");

  return {
    db: {
      updateAgent: async (id, data) => {
        await db.update(agent).set(data).where(eq(agent.id, id));
      },
    },
    github: defaultGithub,
    railway: defaultRailway,
  };
}

function prepareFiles(config: DeployConfig): DeployConfig["files"] {
  const otelEnvContent = [
    `OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_COLLECTOR_ENDPOINT}`,
    `OTEL_SERVICE_NAME=crabfold-${config.agentSlug}`,
    `OTEL_RESOURCE_ATTRIBUTES=agent.id=${config.agentId},agent.fork=${config.fork}`,
  ].join("\n");

  return [...config.files, { content: otelEnvContent, path: ".env.otel" }];
}

/**
 * Main deploy orchestrator. Coordinates GitHub repo creation, Railway project
 * setup, and deployment. Emits SSE events via the provided emit callback.
 */
export async function deployToRailway(
  config: DeployConfig,
  tokens: DeployTokens,
  emit: EmitFn,
  deps: DeployDeps
): Promise<void> {
  const slug = `crabfold-${config.agentSlug}`;
  const { github, railway } = deps;
  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  try {
    emit({
      message: "Injecting OTel config and control API...",
      status: "running",
      step: "prepare",
    });
    const files = prepareFiles(config);
    emit({ status: "done", step: "prepare" });

    emit({
      message: "Creating GitHub repository...",
      status: "running",
      step: "repo",
    });
    const { defaultBranch, fullName } = await github.createRepo(
      tokens.githubToken,
      slug,
      `Crabfold agent: ${config.agentName}`
    );
    await github.pushFiles(
      tokens.githubToken,
      fullName,
      defaultBranch,
      files,
      "feat: initial crabfold agent scaffold"
    );
    emit({ message: fullName, status: "done", step: "repo" });

    emit({
      message: "Creating Railway project...",
      status: "running",
      step: "project",
    });
    const { environmentId, projectId } = await railway.createProject(
      tokens.railwayToken,
      slug
    );
    emit({ status: "done", step: "project" });

    emit({
      message: "Creating Railway service...",
      status: "running",
      step: "service",
    });
    const { serviceId } = await railway.createService(
      tokens.railwayToken,
      projectId,
      environmentId,
      fullName
    );
    emit({ status: "done", step: "service" });

    emit({
      message: "Setting environment variables...",
      status: "running",
      step: "env_vars",
    });
    await railway.upsertVariables(
      tokens.railwayToken,
      projectId,
      environmentId,
      serviceId,
      {
        ...config.envVars,
        OTEL_EXPORTER_OTLP_ENDPOINT: OTEL_COLLECTOR_ENDPOINT,
        OTEL_SERVICE_NAME: slug,
      }
    );
    emit({ status: "done", step: "env_vars" });

    emit({
      message: "Provisioning storage...",
      status: "running",
      step: "storage",
    });
    await (config.fork === "openclaw" || config.fork === "nanobot"
      ? railway.createVolume(
          tokens.railwayToken,
          projectId,
          environmentId,
          serviceId,
          "/data",
          1024
        )
      : railway.createServiceFromImage(
          tokens.railwayToken,
          projectId,
          "postgres:16-alpine"
        ));
    emit({ status: "done", step: "storage" });

    emit({
      message: "Starting deployment...",
      status: "running",
      step: "deploying",
    });
    const { deploymentId } = await railway.triggerDeploy(
      tokens.railwayToken,
      serviceId,
      environmentId
    );
    const { domain } = await railway.createDomain(
      tokens.railwayToken,
      serviceId,
      environmentId
    );
    emit({ domain, status: "running", step: "deploying" });

    const startTime = Date.now();
    let lastStatus = "";

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      const { status } = await railway.getDeploymentStatus(
        tokens.railwayToken,
        deploymentId
      );

      if (status !== lastStatus) {
        lastStatus = status;
        emit({
          buildStatus: status,
          domain,
          status: "running",
          step: "deploying",
        });
      }

      if (status === "SUCCESS") {
        break;
      }

      if (status === "FAILED" || status === "CRASHED" || status === "REMOVED") {
        throw new Error(`Deployment failed with status: ${status}`);
      }

      await sleep(pollIntervalMs);
    }

    if (lastStatus !== "SUCCESS") {
      throw new Error("Deployment timed out after 10 minutes");
    }

    const deploymentUrl = `https://${domain}`;
    await deps.db.updateAgent(config.agentId, {
      deploymentUrl,
      railwayProjectId: projectId,
      status: "live",
    });

    emit({
      event: "complete",
      railwayProjectId: projectId,
      url: deploymentUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    try {
      await deps.db.updateAgent(config.agentId, { status: "error" });
    } catch {
      // Best-effort DB update
    }

    emit({
      event: "error",
      message,
      step: "deploying",
    });
  }
}
