export type HealthStatus = "healthy" | "degraded" | "down";

export interface AgentHealth {
  status: HealthStatus;
  uptime?: number;
  activeThreads?: number;
}

/**
 * Check the health of a deployed agent by calling its /health endpoint.
 * Returns "down" if the request fails or times out.
 */
export async function checkAgentHealth(
  deploymentUrl: string
): Promise<AgentHealth> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${deploymentUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { status: "degraded" };
    }

    const data = (await res.json()) as Partial<AgentHealth>;
    return {
      activeThreads: data.activeThreads ?? 0,
      status: data.status === "healthy" ? "healthy" : "degraded",
      uptime: data.uptime ?? 0,
    };
  } catch {
    return { status: "down" };
  }
}
