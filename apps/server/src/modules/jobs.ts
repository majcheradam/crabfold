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

          const send = (data: unknown) => {
            const event =
              typeof data === "object" && data !== null && "event" in data
                ? (data as { event: string }).event
                : "message";

            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
              )
            );
          };

          const unsubscribe = subscribeToJob(jobId, (event) => {
            send(event);

            if (event.event === "complete" || event.event === "error") {
              controller.close();
            }
          });

          if (!unsubscribe) {
            send({ data: { message: "Job not found" }, event: "error" });
            controller.close();
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
