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

function dockerfileTemplate(base: string): string {
  return [
    `FROM ${base}`,
    `WORKDIR /app`,
    `COPY package.json .`,
    `RUN npm install --production`,
    `COPY . .`,
    `CMD ["npm", "start"]`,
  ].join("\n");
}

function generateOpenclawFiles(config: AgentConfig, soul: string): AgentFile[] {
  return [
    { content: soul, path: "SOUL.md" },
    { content: gatewayConfigTemplate(config.channels), path: "openclaw.json5" },
    {
      content: JSON.stringify(
        {
          dependencies: { openclaw: "latest" },
          name: "crabfold-agent",
          private: true,
          scripts: { start: "node index.js" },
          type: "module",
        },
        null,
        2
      ),
      path: "package.json",
    },
    {
      content: [
        `import { createAgent } from "openclaw";`,
        ``,
        `const agent = createAgent({`,
        `  soul: "./SOUL.md",`,
        `  skills: ${JSON.stringify(config.skills)},`,
        `});`,
        ``,
        `agent.start();`,
      ].join("\n"),
      path: "index.js",
    },
    { content: dockerfileTemplate("node:22-alpine"), path: "Dockerfile" },
  ];
}

function generateNanobotFiles(config: AgentConfig, soul: string): AgentFile[] {
  return [
    { content: soul, path: "SOUL.md" },
    { content: gatewayConfigTemplate(config.channels), path: "openclaw.json5" },
    {
      content: JSON.stringify(
        {
          dependencies: { nanobot: "latest" },
          name: "crabfold-agent",
          private: true,
          scripts: { start: "node index.js" },
          type: "module",
        },
        null,
        2
      ),
      path: "package.json",
    },
    {
      content: [
        `import pkg from "nanobot";`,
        `const { Nanobot } = pkg;`,
        ``,
        `const bot = new Nanobot({`,
        `  soul: "./SOUL.md",`,
        `  memory: "./memory",`,
        `  skills: ${JSON.stringify(config.skills)},`,
        `});`,
        ``,
        `bot.start();`,
      ].join("\n"),
      path: "index.js",
    },
    { content: dockerfileTemplate("node:22-alpine"), path: "Dockerfile" },
  ];
}

function generateIronclawFiles(config: AgentConfig, soul: string): AgentFile[] {
  return [
    { content: soul, path: "SOUL.md" },
    { content: gatewayConfigTemplate(config.channels), path: "openclaw.json5" },
    {
      content: JSON.stringify(
        {
          dependencies: { ironclaw: "latest", pg: "^8.20.0" },
          name: "crabfold-agent",
          private: true,
          scripts: { start: "node index.js" },
          type: "module",
        },
        null,
        2
      ),
      path: "package.json",
    },
    {
      content: [
        `import { Ironclaw } from "ironclaw";`,
        ``,
        `const agent = new Ironclaw({`,
        `  soul: "./SOUL.md",`,
        `  database: process.env.DATABASE_URL,`,
        `  skills: ${JSON.stringify(config.skills)},`,
        `});`,
        ``,
        `agent.start();`,
      ].join("\n"),
      path: "index.js",
    },
    { content: dockerfileTemplate("node:22-alpine"), path: "Dockerfile" },
  ];
}

export function generateFiles(config: AgentConfig, soul: string): AgentFile[] {
  switch (config.fork) {
    case "openclaw": {
      return generateOpenclawFiles(config, soul);
    }
    case "nanobot": {
      return generateNanobotFiles(config, soul);
    }
    case "ironclaw": {
      return generateIronclawFiles(config, soul);
    }
    default: {
      return generateOpenclawFiles(config, soul);
    }
  }
}
