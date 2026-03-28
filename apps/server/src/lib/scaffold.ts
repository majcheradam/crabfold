import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { AgentChannel, AgentConfig } from "@crabfold/db/schema/agent";
import { env } from "@crabfold/env/server";
import { generateObject, streamText } from "ai";
import { z } from "zod";

import { emitJobEvent } from "./job-store";

const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
const model = google("gemini-2.5-flash");

const ForkSchema = z.object({
  fork: z.enum(["openclaw", "nanobot", "ironclaw"]),
  reasoning: z.string(),
});

async function selectFork(
  jobId: string,
  prompt: string
): Promise<z.infer<typeof ForkSchema>> {
  emitJobEvent(jobId, {
    data: {},
    label: "Analyzing request...",
    status: "running",
    step: "fork",
  });

  const { object } = await generateObject({
    model,
    prompt: [
      "You are selecting the best agent framework fork for a user's request.",
      "Options:",
      "- openclaw: Simple single-purpose agents, file-based threads, lightweight",
      "- nanobot: Mid-complexity agents with memory, file-based threads + JSON memory",
      "- ironclaw: Complex multi-step agents requiring database-backed threads and state",
      "",
      `User request: ${prompt}`,
    ].join("\n"),
    schema: ForkSchema,
  });

  emitJobEvent(jobId, {
    data: { fork: object.fork, reasoning: object.reasoning },
    label: `Selected ${object.fork}`,
    status: "done",
    step: "fork",
  });

  return object;
}

async function searchSkills(jobId: string, prompt: string): Promise<string[]> {
  emitJobEvent(jobId, {
    data: {},
    label: "Searching skills...",
    status: "running",
    step: "skills",
  });

  try {
    const keywords = prompt
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5)
      .join("+");

    const res = await fetch(
      `${env.CLAWHUB_API_URL}/api/v1/search?q=${encodeURIComponent(keywords)}`
    );

    if (!res.ok) {
      emitJobEvent(jobId, {
        data: {},
        label: "No skills found",
        status: "done",
        step: "skills",
      });
      return [];
    }

    const { results } = (await res.json()) as {
      results: { slug: string; displayName: string; summary: string | null }[];
    };
    const skills = results.map((s) => s.slug);

    emitJobEvent(jobId, {
      data: { skills },
      label: `Found ${skills.length} skills`,
      status: "done",
      step: "skills",
    });

    return skills;
  } catch {
    emitJobEvent(jobId, {
      data: {},
      label: "Skill search unavailable",
      status: "done",
      step: "skills",
    });
    return [];
  }
}

const AVAILABLE_CHANNELS: AgentChannel[] = [
  { id: "whatsapp", label: "WhatsApp", recommended: true },
  { id: "slack", label: "Slack", recommended: true },
  { id: "telegram", label: "Telegram" },
  { id: "discord", label: "Discord" },
  { id: "signal", label: "Signal" },
  { id: "msteams", label: "Microsoft Teams" },
  { id: "webchat", label: "WebChat" },
];

const ChannelsSchema = z.object({
  channelIds: z
    .array(z.string())
    .describe("IDs of the channels to enable for this agent"),
  reasoning: z.string(),
});

async function selectChannels(
  jobId: string,
  prompt: string
): Promise<AgentChannel[]> {
  emitJobEvent(jobId, {
    data: {},
    label: "Selecting connectors...",
    status: "running",
    step: "channels",
  });

  const { object } = await generateObject({
    model,
    prompt: [
      "You are selecting messaging channels/connectors for an AI agent.",
      "Always include whatsapp and slack as defaults unless the user explicitly excludes them.",
      "Add other channels only if the user's request strongly implies them (e.g. gaming -> discord, enterprise -> msteams).",
      "",
      "Available channels:",
      ...AVAILABLE_CHANNELS.map(
        (c) =>
          `- ${c.id}: ${c.label}${c.recommended ? " (recommended default)" : ""}`
      ),
      "",
      `User request: ${prompt}`,
    ].join("\n"),
    schema: ChannelsSchema,
  });

  const selected = AVAILABLE_CHANNELS.filter((c) =>
    object.channelIds.includes(c.id)
  );

  emitJobEvent(jobId, {
    data: { channels: selected },
    label: `${selected.length} connectors configured`,
    status: "done",
    step: "channels",
  });

  return selected;
}

async function generateSoul(jobId: string, prompt: string): Promise<string> {
  emitJobEvent(jobId, {
    data: {},
    label: "Generating personality...",
    status: "running",
    step: "soul",
  });

  let soul = "";

  const { textStream } = streamText({
    model,
    prompt: [
      "Generate a SOUL.md file for an autonomous AI agent based on this description.",
      "The SOUL.md defines the agent's personality, goals, constraints, and behavior.",
      "Use markdown format. Be concise but thorough.",
      "",
      `Description: ${prompt}`,
    ].join("\n"),
  });

  for await (const chunk of textStream) {
    soul += chunk;
    emitJobEvent(jobId, {
      data: { text: chunk },
      event: "soul_chunk",
    });
  }

  emitJobEvent(jobId, {
    data: {},
    status: "done",
    step: "soul",
  });

  return soul;
}

export async function runScaffold(
  jobId: string,
  prompt: string
): Promise<{ config: AgentConfig; soul: string }> {
  const [forkResult, skills, channels, soul] = await Promise.all([
    selectFork(jobId, prompt),
    searchSkills(jobId, prompt),
    selectChannels(jobId, prompt),
    generateSoul(jobId, prompt),
  ]);

  emitJobEvent(jobId, {
    data: {},
    label: "Assembling agent...",
    status: "running",
    step: "assemble",
  });

  const config: AgentConfig = {
    channels,
    fork: forkResult.fork,
    prompt,
    reasoning: forkResult.reasoning,
    skills,
  };

  return { config, soul };
}
