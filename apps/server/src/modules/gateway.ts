import { Elysia, t } from "elysia";

import { validateApiKey } from "../lib/api-key";
import { checkRateLimit } from "../lib/rate-limiter";

/**
 * Gateway module — proxy external API consumers to deployed agents.
 * Validates API key, enforces rate limits, resolves deployment URL,
 * and proxies the request with stream passthrough.
 */
export const gatewayModule = new Elysia({ prefix: "/gateway" }).post(
  "/:agentId/chat",
  async ({ params, body, request, set }) => {
    // Extract API key from Authorization header or body
    const authHeader = request.headers.get("Authorization");
    const apiKeyStr = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : ((body as Record<string, unknown>).api_key as string | undefined);

    if (!apiKeyStr) {
      set.status = 401;
      return { error: "Missing API key" };
    }

    // Validate API key
    const keyData = await validateApiKey(apiKeyStr);
    if (!keyData) {
      set.status = 401;
      return { error: "Invalid or revoked API key" };
    }

    // Verify key matches the requested agent
    if (keyData.agentId !== params.agentId) {
      set.status = 403;
      return { error: "API key does not match agent" };
    }

    // Check agent is deployed
    if (keyData.agentStatus !== "live" || !keyData.agentDeploymentUrl) {
      set.status = 503;
      return { error: "Agent is not deployed" };
    }

    // Rate limit check
    const rateResult = checkRateLimit(keyData.keyId, keyData.rateLimit);
    if (!rateResult.allowed) {
      set.status = 429;
      set.headers["Retry-After"] = String(Math.ceil(rateResult.resetMs / 1000));
      set.headers["X-RateLimit-Remaining"] = "0";
      return { error: "Rate limit exceeded", retryAfterMs: rateResult.resetMs };
    }

    set.headers["X-RateLimit-Remaining"] = String(rateResult.remaining);

    // Proxy request to deployed agent
    const proxyUrl = `${keyData.agentDeploymentUrl}/api/chat`;
    const startTime = Date.now();

    try {
      const proxyRes = await fetch(proxyUrl, {
        body: JSON.stringify({ message: body.message }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const latencyMs = Date.now() - startTime;

      // If the response is streaming, pass through
      if (
        proxyRes.headers.get("Content-Type")?.includes("text/event-stream") ||
        proxyRes.headers.get("Transfer-Encoding") === "chunked"
      ) {
        return new Response(proxyRes.body, {
          headers: {
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Content-Type":
              proxyRes.headers.get("Content-Type") ?? "text/event-stream",
            "X-Gateway-Latency": String(latencyMs),
          },
        });
      }

      // Non-streaming response
      const data = await proxyRes.json();
      set.headers["X-Gateway-Latency"] = String(latencyMs);
      return data;
    } catch (error) {
      set.status = 502;
      return {
        error: "Failed to proxy to agent",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    body: t.Object({
      api_key: t.Optional(t.String()),
      message: t.String({ minLength: 1 }),
    }),
    params: t.Object({ agentId: t.String() }),
  }
);
