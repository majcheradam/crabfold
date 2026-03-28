import { relations } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const agentStatusEnum = pgEnum("agent_status", [
  "draft",
  "deploying",
  "live",
  "error",
]);

export const forkEnum = pgEnum("fork", ["openclaw", "nanobot", "ironclaw"]);

export const agent = pgTable("agent", {
  config: jsonb("config").$type<AgentConfig>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deploymentUrl: text("deployment_url"),
  files: jsonb("files").$type<AgentFile[]>().notNull().default([]),
  fork: forkEnum("fork").notNull(),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  railwayProjectId: text("railway_project_id"),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  slug: text("slug").notNull(),
  soul: text("soul").notNull(),
  status: agentStatusEnum("status").notNull().default("draft"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const agentRelations = relations(agent, ({ one }) => ({
  user: one(user, {
    fields: [agent.userId],
    references: [user.id],
  }),
}));

export interface AgentChannel {
  id: string;
  label: string;
  recommended?: boolean;
}

export interface AgentConfig {
  channels: AgentChannel[];
  fork: string;
  prompt: string;
  reasoning?: string;
  skills: string[];
}

export interface AgentFile {
  content: string;
  path: string;
}
