import { describe, expect, test } from "bun:test";

import { checkAgentHealth } from "./health-check";

describe("checkAgentHealth", () => {
  test("returns healthy when endpoint responds with healthy status", async () => {
    const server = Bun.serve({
      fetch() {
        return Response.json({
          activeThreads: 3,
          status: "healthy",
          uptime: 12_345,
        });
      },
      port: 0,
    });

    const result = await checkAgentHealth(`http://localhost:${server.port}`);
    expect(result.status).toBe("healthy");
    expect(result.activeThreads).toBe(3);
    expect(result.uptime).toBe(12_345);

    server.stop(true);
  });

  test("returns degraded when endpoint responds with non-healthy status", async () => {
    const server = Bun.serve({
      fetch() {
        return Response.json({ status: "degraded" });
      },
      port: 0,
    });

    const result = await checkAgentHealth(`http://localhost:${server.port}`);
    expect(result.status).toBe("degraded");

    server.stop(true);
  });

  test("returns degraded when endpoint responds with non-200 status code", async () => {
    const server = Bun.serve({
      fetch() {
        return new Response("Service Unavailable", { status: 503 });
      },
      port: 0,
    });

    const result = await checkAgentHealth(`http://localhost:${server.port}`);
    expect(result.status).toBe("degraded");

    server.stop(true);
  });

  test("returns down when endpoint is unreachable", async () => {
    const result = await checkAgentHealth("http://localhost:1");
    expect(result.status).toBe("down");
  });

  test("returns defaults for missing fields in response", async () => {
    const server = Bun.serve({
      fetch() {
        return Response.json({ status: "healthy" });
      },
      port: 0,
    });

    const result = await checkAgentHealth(`http://localhost:${server.port}`);
    expect(result.status).toBe("healthy");
    expect(result.activeThreads).toBe(0);
    expect(result.uptime).toBe(0);

    server.stop(true);
  });
});
