import { afterEach, describe, expect, mock, test } from "bun:test";

import { createRepo, pushFiles } from "./github";

const originalFetch = globalThis.fetch;

interface FetchCall {
  body?: unknown;
  method: string;
  path: string;
}
const calls: FetchCall[] = [];

function mockFetchSequence(responses: { data: unknown }[]) {
  let callIndex = 0;
  calls.length = 0;

  globalThis.fetch = mock(
    (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const path = url.replace("https://api.github.com", "");
      const idx = callIndex;
      callIndex = idx + 1;
      calls.push({
        body: init?.body ? JSON.parse(init.body as string) : undefined,
        method: init?.method ?? "GET",
        path,
      });

      const response = responses[idx];
      return Promise.resolve({
        json: () => Promise.resolve(response?.data),
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(response?.data)),
      } as Response);
    }
  );
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  calls.length = 0;
});

describe("github", () => {
  describe("createRepo", () => {
    test("creates a repo and returns metadata", async () => {
      mockFetchSequence([
        {
          data: {
            default_branch: "main",
            full_name: "user/crabfold-my-agent",
            html_url: "https://github.com/user/crabfold-my-agent",
          },
        },
      ]);

      const result = await createRepo(
        "ghp_token",
        "crabfold-my-agent",
        "Crabfold agent: My Agent"
      );

      expect(result.repoUrl).toBe("https://github.com/user/crabfold-my-agent");
      expect(result.fullName).toBe("user/crabfold-my-agent");
      expect(result.defaultBranch).toBe("main");

      expect(calls[0]?.method).toBe("POST");
      expect(calls[0]?.path).toBe("/user/repos");
      expect(calls[0]?.body).toEqual({
        auto_init: true,
        description: "Crabfold agent: My Agent",
        name: "crabfold-my-agent",
        private: false,
      });
    });

    test("throws on API error", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          text: () => Promise.resolve("Repository already exists"),
        } as Response)
      );

      await expect(
        createRepo("ghp_token", "existing-repo", "desc")
      ).rejects.toThrow("GitHub API error (422)");
    });
  });

  describe("pushFiles", () => {
    test("pushes files via Git Trees API in correct order", async () => {
      mockFetchSequence([
        { data: { object: { sha: "ref-sha-1" } } },
        { data: { tree: { sha: "tree-sha-1" } } },
        { data: { sha: "blob-sha-1" } },
        { data: { sha: "blob-sha-2" } },
        { data: { sha: "new-tree-sha" } },
        { data: { sha: "new-commit-sha" } },
        { data: {} },
      ]);

      const result = await pushFiles(
        "ghp_token",
        "user/repo",
        "main",
        [
          { content: "console.log('hello')", path: "index.ts" },
          { content: '{"name":"agent"}', path: "package.json" },
        ],
        "feat: initial scaffold"
      );

      expect(result.commitSha).toBe("new-commit-sha");

      expect(calls[0]?.method).toBe("GET");
      expect(calls[0]?.path).toBe("/repos/user/repo/git/ref/heads/main");

      expect(calls[1]?.method).toBe("GET");
      expect(calls[1]?.path).toBe("/repos/user/repo/git/commits/ref-sha-1");

      expect(calls[2]?.method).toBe("POST");
      expect(calls[2]?.path).toBe("/repos/user/repo/git/blobs");
      expect(calls[2]?.body).toEqual({
        content: "console.log('hello')",
        // eslint-disable-next-line unicorn/text-encoding-identifier-case
        encoding: "utf-8",
      });

      expect(calls[3]?.method).toBe("POST");
      expect(calls[3]?.path).toBe("/repos/user/repo/git/blobs");

      expect(calls[4]?.method).toBe("POST");
      expect(calls[4]?.path).toBe("/repos/user/repo/git/trees");
      expect(calls[4]?.body).toEqual({
        base_tree: "tree-sha-1",
        tree: [
          {
            mode: "100644",
            path: "index.ts",
            sha: "blob-sha-1",
            type: "blob",
          },
          {
            mode: "100644",
            path: "package.json",
            sha: "blob-sha-2",
            type: "blob",
          },
        ],
      });

      expect(calls[5]?.method).toBe("POST");
      expect(calls[5]?.path).toBe("/repos/user/repo/git/commits");
      expect(calls[5]?.body).toEqual({
        message: "feat: initial scaffold",
        parents: ["ref-sha-1"],
        tree: "new-tree-sha",
      });

      expect(calls[6]?.method).toBe("PATCH");
      expect(calls[6]?.path).toBe("/repos/user/repo/git/refs/heads/main");
      expect(calls[6]?.body).toEqual({ sha: "new-commit-sha" });
    });
  });
});
