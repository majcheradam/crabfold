import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { agent } from "./agent";
import { user } from "./auth";

export const agentSkill = pgTable("agent_skill", {
  agentId: text("agent_id")
    .notNull()
    .references(() => agent.id, { onDelete: "cascade" }),
  id: text("id").primaryKey(),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
  skillId: text("skill_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const agentSkillRelations = relations(agentSkill, ({ one }) => ({
  agent: one(agent, {
    fields: [agentSkill.agentId],
    references: [agent.id],
  }),
  user: one(user, {
    fields: [agentSkill.userId],
    references: [user.id],
  }),
}));
