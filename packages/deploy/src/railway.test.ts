import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  createDomain,
  createProject,
  createService,
  createServiceFromImage,
  createVolume,
  getDeploymentStatus,
  triggerDeploy,
  upsertVariables,
} from "./railway";

const originalFetch = globalThis.fetch;

function mockFetch(data: unknown, ok = true, status = 200) {
  globalThis.fetch = mock(() =>
    Promise.resolve({
      json: () => Promise.resolve(data),
      ok,
      status,
      text: () => Promise.resolve(JSON.stringify(data)),
    } as Response)
  );
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("railway", () => {
  describe("createProject", () => {
    test("returns projectId and environmentId", async () => {
      mockFetch({
        data: {
          projectCreate: {
            environments: {
              edges: [{ node: { id: "env-456" } }],
            },
            id: "proj-123",
          },
        },
      });

      const result = await createProject("token", "my-project");
      expect(result.projectId).toBe("proj-123");
      expect(result.environmentId).toBe("env-456");
    });

    test("throws on HTTP error", async () => {
      mockFetch("Unauthorized", false, 401);
      await expect(createProject("bad-token", "proj")).rejects.toThrow(
        "Railway API error (401)"
      );
    });

    test("throws on GraphQL error", async () => {
      mockFetch({
        errors: [{ message: "Project name taken" }],
      });
      await expect(createProject("token", "taken-name")).rejects.toThrow(
        "Railway GraphQL error: Project name taken"
      );
    });
  });

  describe("createService", () => {
    test("returns serviceId", async () => {
      mockFetch({
        data: { serviceCreate: { id: "svc-789" } },
      });

      const result = await createService(
        "token",
        "proj-1",
        "env-1",
        "user/repo"
      );
      expect(result.serviceId).toBe("svc-789");
    });
  });

  describe("createServiceFromImage", () => {
    test("returns serviceId for image-based service", async () => {
      mockFetch({
        data: { serviceCreate: { id: "svc-db" } },
      });

      const result = await createServiceFromImage(
        "token",
        "proj-1",
        "postgres:16-alpine"
      );
      expect(result.serviceId).toBe("svc-db");
    });
  });

  describe("upsertVariables", () => {
    test("does not throw on success", async () => {
      mockFetch({ data: { variableCollectionUpsert: true } });

      await expect(
        upsertVariables("token", "proj-1", "env-1", "svc-1", {
          API_KEY: "secret",
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("createVolume", () => {
    test("returns volumeId", async () => {
      mockFetch({
        data: { volumeCreate: { id: "vol-123" } },
      });

      const result = await createVolume(
        "token",
        "proj-1",
        "env-1",
        "svc-1",
        "/data",
        1024
      );
      expect(result.volumeId).toBe("vol-123");
    });
  });

  describe("triggerDeploy", () => {
    test("returns deploymentId", async () => {
      mockFetch({
        data: { serviceInstanceDeployV2: "deploy-abc" },
      });

      const result = await triggerDeploy("token", "svc-1", "env-1");
      expect(result.deploymentId).toBe("deploy-abc");
    });
  });

  describe("createDomain", () => {
    test("returns domain", async () => {
      mockFetch({
        data: {
          serviceDomainCreate: {
            domain: "my-app-production.up.railway.app",
          },
        },
      });

      const result = await createDomain("token", "svc-1", "env-1");
      expect(result.domain).toBe("my-app-production.up.railway.app");
    });
  });

  describe("getDeploymentStatus", () => {
    test("returns deployment status", async () => {
      mockFetch({
        data: { deployment: { status: "SUCCESS" } },
      });

      const result = await getDeploymentStatus("token", "deploy-1");
      expect(result.status).toBe("SUCCESS");
    });

    test("returns BUILDING status during build", async () => {
      mockFetch({
        data: { deployment: { status: "BUILDING" } },
      });

      const result = await getDeploymentStatus("token", "deploy-1");
      expect(result.status).toBe("BUILDING");
    });
  });

  describe("error handling", () => {
    test("throws when API returns no data", async () => {
      mockFetch({});
      await expect(createProject("token", "proj")).rejects.toThrow(
        "Railway API returned no data"
      );
    });
  });
});
