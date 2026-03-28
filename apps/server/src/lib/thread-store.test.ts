import { describe, expect, mock, test } from "bun:test";

import {
  createThreadStore,
  IronclawThreadStore,
  NanobotThreadStore,
  OpenclawThreadStore,
} from "./thread-store";

describe("createThreadStore", () => {
  test("returns adapter with listThreads and getHistory for openclaw", () => {
    const store = createThreadStore("openclaw");
    expect(typeof store.listThreads).toBe("function");
    expect(typeof store.getHistory).toBe("function");
  });

  test("returns adapter with listThreads and getHistory for nanobot", () => {
    const store = createThreadStore("nanobot");
    expect(typeof store.listThreads).toBe("function");
    expect(typeof store.getHistory).toBe("function");
  });

  test("returns adapter with listThreads and getHistory for ironclaw", () => {
    const store = createThreadStore("ironclaw");
    expect(typeof store.listThreads).toBe("function");
    expect(typeof store.getHistory).toBe("function");
  });
});

describe("OpenclawThreadStore", () => {
  const store = new OpenclawThreadStore();

  test("listThreads calls agent API with correct params", async () => {
    const mockThreads = [
      {
        id: "t1",
        lastMessage: "hello",
        messageCount: 5,
        title: "Thread 1",
        updatedAt: "2026-03-28T00:00:00Z",
      },
    ];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock((url: string) => {
      expect(url).toBe(
        "https://agent.example.com/api/threads?limit=10&sort=recent"
      );
      return Response.json({ threads: mockThreads });
    }) as unknown as typeof fetch;

    const threads = await store.listThreads("https://agent.example.com", {
      limit: 10,
      sort: "recent",
    });

    expect(threads).toEqual(mockThreads);
    globalThis.fetch = originalFetch;
  });

  test("listThreads returns empty array on failure", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(
      () => new Response("Not Found", { status: 404 })
    ) as unknown as typeof fetch;

    const threads = await store.listThreads("https://agent.example.com", {
      limit: 10,
      sort: "recent",
    });

    expect(threads).toEqual([]);
    globalThis.fetch = originalFetch;
  });

  test("getHistory calls agent API with correct params", async () => {
    const mockHistory = {
      id: "t1",
      messages: [
        {
          content: "hello",
          id: "m1",
          role: "user" as const,
          timestamp: "2026-03-28T00:00:00Z",
        },
      ],
      title: "Thread 1",
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock((url: string) => {
      expect(url).toBe("https://agent.example.com/api/threads/t1?limit=50");
      return Response.json(mockHistory);
    }) as unknown as typeof fetch;

    const history = await store.getHistory("https://agent.example.com", "t1", {
      limit: 50,
    });

    expect(history).toEqual(mockHistory);
    globalThis.fetch = originalFetch;
  });

  test("getHistory returns null on failure", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(
      () => new Response("Not Found", { status: 404 })
    ) as unknown as typeof fetch;

    const history = await store.getHistory("https://agent.example.com", "t1", {
      limit: 50,
    });

    expect(history).toBeNull();
    globalThis.fetch = originalFetch;
  });
});

describe("NanobotThreadStore", () => {
  const store = new NanobotThreadStore();

  test("listThreads calls agent API", async () => {
    const mockThreads = [
      {
        id: "t1",
        lastMessage: "hello",
        messageCount: 3,
        title: "Thread 1",
        updatedAt: "2026-03-28T00:00:00Z",
      },
    ];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Response.json({ threads: mockThreads })
    ) as unknown as typeof fetch;

    const threads = await store.listThreads("https://agent.example.com", {
      limit: 20,
      sort: "recent",
    });

    expect(threads).toEqual(mockThreads);
    globalThis.fetch = originalFetch;
  });
});

describe("IronclawThreadStore", () => {
  const store = new IronclawThreadStore();

  test("listThreads calls agent API", async () => {
    const mockThreads = [
      {
        id: "t1",
        lastMessage: "hello",
        messageCount: 10,
        title: "Thread 1",
        updatedAt: "2026-03-28T00:00:00Z",
      },
    ];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Response.json({ threads: mockThreads })
    ) as unknown as typeof fetch;

    const threads = await store.listThreads("https://agent.example.com", {
      limit: 20,
      sort: "recent",
    });

    expect(threads).toEqual(mockThreads);
    globalThis.fetch = originalFetch;
  });

  test("getHistory returns null for missing thread", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(
      () => new Response("Not Found", { status: 404 })
    ) as unknown as typeof fetch;

    const history = await store.getHistory(
      "https://agent.example.com",
      "missing",
      { limit: 100 }
    );

    expect(history).toBeNull();
    globalThis.fetch = originalFetch;
  });
});
