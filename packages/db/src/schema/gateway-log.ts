import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { agent } from "./agent";
import { apiKey } from "./api-key";

export const gatewayLog = pgTable("gateway_log", {
  agentId: text("agent_id")
    .notNull()
    .references(() => agent.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  durationMs: integer("duration_ms").notNull(),
  id: text("id").primaryKey(),
  keyId: text("key_id")
    .notNull()
    .references(() => apiKey.id, { onDelete: "cascade" }),
  status: integer("status").notNull(),
  tokenCount: integer("token_count"),
});

export const gatewayLogRelations = relations(gatewayLog, ({ one }) => ({
  agent: one(agent, {
    fields: [gatewayLog.agentId],
    references: [agent.id],
  }),
  apiKey: one(apiKey, {
    fields: [gatewayLog.keyId],
    references: [apiKey.id],
  }),
}));
