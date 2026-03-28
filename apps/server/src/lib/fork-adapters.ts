import type {
  AgentChannel,
  AgentConfig,
  AgentFile,
} from "@crabfold/db/schema/agent";

function gatewayConfigTemplate(channels: AgentChannel[]): string {
  const channelEntries = channels
    .map(
      (c) =>
        `    ${c.id}: {\n      enabled: true,\n      dmPolicy: "pairing",\n    }`
    )
    .join(",\n");

  return [
    "{",
    "  // Gateway channel configuration",
    "  // Run: openclaw channels login --channel <name> to link each channel",
    "  channels: {",
    channelEntries,
    "  },",
    "}",
  ].join("\n");
}

function openclawConfigTemplate(channels: AgentChannel[]): string {
  const channelEntries: Record<string, { enabled: boolean }> = {};
  for (const c of channels) {
    channelEntries[c.id] = { enabled: true };
  }
  return JSON.stringify(
    {
      agents: {
        defaults: {
          model: { primary: "google/gemini-2.5-flash" },
        },
      },
      auth: {
        profiles: {
          google: {
            mode: "api_key",
            provider: "google",
          },
        },
      },
      channels: channelEntries,
      gateway: { mode: "local" },
    },
    null,
    2
  );
}

function dockerfileTemplate(base: string): string {
  return [
    `FROM ${base}`,
    `WORKDIR /app`,
    `COPY package.json .`,
    `RUN npm install --production`,
    `COPY . .`,
    `RUN mkdir -p /root/.openclaw && cp openclaw.json /root/.openclaw/openclaw.json`,
    `RUN mkdir -p /root/.config/openclaw && cp openclaw.json /root/.config/openclaw/config.json`,
    `CMD ["npm", "start"]`,
  ].join("\n");
}

function generateOpenclawFiles(config: AgentConfig, soul: string): AgentFile[] {
  return [
    { content: soul, path: "SOUL.md" },
    { content: gatewayConfigTemplate(config.channels), path: "openclaw.json5" },
    {
      content: openclawConfigTemplate(config.channels),
      path: "openclaw.json",
    },
    {
      content: JSON.stringify(
        {
          dependencies: { openclaw: "latest" },
          name: "crabfold-agent",
          private: true,
          scripts: {
            // eslint-disable-next-line no-template-curly-in-string
            start: "openclaw gateway --allow-unconfigured --port ${PORT:-3000}",
          },
        },
        null,
        2
      ),
      path: "package.json",
    },
    { content: dockerfileTemplate("node:22-alpine"), path: "Dockerfile" },
  ];
}

export function generateFiles(config: AgentConfig, soul: string): AgentFile[] {
  return generateOpenclawFiles(config, soul);
}
