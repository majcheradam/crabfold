import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { agent } from "./agent";
import { user } from "./auth";

export const apiKey = pgTable("api_key", {
  agentId: text("agent_id")
    .notNull()
    .references(() => agent.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: text("id").primaryKey(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  label: text("label").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  rateLimit: integer("rate_limit").notNull().default(60),
  revokedAt: timestamp("revoked_at"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
  agent: one(agent, {
    fields: [apiKey.agentId],
    references: [agent.id],
  }),
  user: one(user, {
    fields: [apiKey.userId],
    references: [user.id],
  }),
}));
