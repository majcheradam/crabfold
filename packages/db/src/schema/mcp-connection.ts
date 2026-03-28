import { relations } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { agent } from "./agent";
import { user } from "./auth";

export const mcpConnection = pgTable("mcp_connection", {
  agentId: text("agent_id")
    .notNull()
    .references(() => agent.id, { onDelete: "cascade" }),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tools: jsonb("tools").$type<string[]>().notNull().default([]),
  url: text("url").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const mcpConnectionRelations = relations(mcpConnection, ({ one }) => ({
  agent: one(agent, {
    fields: [mcpConnection.agentId],
    references: [agent.id],
  }),
  user: one(user, {
    fields: [mcpConnection.userId],
    references: [user.id],
  }),
}));
