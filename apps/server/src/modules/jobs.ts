import { Elysia } from "elysia";

import { subscribeToJob } from "../lib/job-store";

export const jobsModule = new Elysia({ prefix: "/api/jobs" }).get(
  "/:jobId/stream",
  ({ params }) => {
    const { jobId } = params;

    return new Response(
      new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          let closed = false;

          const send = (data: unknown) => {
            if (closed) {
              return;
            }
            const event =
              typeof data === "object" && data !== null && "event" in data
                ? (data as { event: string }).event
                : "message";

            try {
              controller.enqueue(
                encoder.encode(
                  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
                )
              );
            } catch {
              closed = true;
            }
          };

          const unsubscribe = subscribeToJob(jobId, (event) => {
            send(event);

            if (
              (event.event === "complete" || event.event === "error") &&
              !closed
            ) {
              closed = true;
              try {
                controller.close();
              } catch {
                // already closed
              }
            }
          });

          if (!unsubscribe) {
            send({ data: { message: "Job not found" }, event: "error" });
            if (!closed) {
              closed = true;
              try {
                controller.close();
              } catch {
                // already closed
              }
            }
          }
        },
      }),
      {
        headers: {
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
        },
      }
    );
  }
);
