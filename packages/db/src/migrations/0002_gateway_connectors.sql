-- API keys table for gateway authentication
CREATE TABLE IF NOT EXISTS "api_key" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "agent_id" text NOT NULL REFERENCES "agent"("id") ON DELETE CASCADE,
  "key_hash" text NOT NULL UNIQUE,
  "key_prefix" text NOT NULL,
  "label" text NOT NULL,
  "rate_limit" integer NOT NULL DEFAULT 60,
  "last_used_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "api_key" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_key" FORCE ROW LEVEL SECURITY;

CREATE POLICY "api_key_select_own" ON "api_key"
  FOR SELECT USING ("user_id" = current_setting('app.user_id', true));
CREATE POLICY "api_key_insert_own" ON "api_key"
  FOR INSERT WITH CHECK ("user_id" = current_setting('app.user_id', true));
CREATE POLICY "api_key_update_own" ON "api_key"
  FOR UPDATE USING ("user_id" = current_setting('app.user_id', true));
CREATE POLICY "api_key_delete_own" ON "api_key"
  FOR DELETE USING ("user_id" = current_setting('app.user_id', true));

-- Installed skills per agent
CREATE TABLE IF NOT EXISTS "agent_skill" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "agent_id" text NOT NULL REFERENCES "agent"("id") ON DELETE CASCADE,
  "skill_id" text NOT NULL,
  "installed_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "agent_skill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_skill" FORCE ROW LEVEL SECURITY;

CREATE POLICY "agent_skill_select_own" ON "agent_skill"
  FOR SELECT USING ("user_id" = current_setting('app.user_id', true));
CREATE POLICY "agent_skill_insert_own" ON "agent_skill"
  FOR INSERT WITH CHECK ("user_id" = current_setting('app.user_id', true));
CREATE POLICY "agent_skill_delete_own" ON "agent_skill"
  FOR DELETE USING ("user_id" = current_setting('app.user_id', true));

-- MCP server connections per agent
CREATE TABLE IF NOT EXISTS "mcp_connection" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "agent_id" text NOT NULL REFERENCES "agent"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "name" text NOT NULL,
  "tools" jsonb NOT NULL DEFAULT '[]',
  "connected_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "mcp_connection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mcp_connection" FORCE ROW LEVEL SECURITY;

CREATE POLICY "mcp_connection_select_own" ON "mcp_connection"
  FOR SELECT USING ("user_id" = current_setting('app.user_id', true));
CREATE POLICY "mcp_connection_insert_own" ON "mcp_connection"
  FOR INSERT WITH CHECK ("user_id" = current_setting('app.user_id', true));
CREATE POLICY "mcp_connection_delete_own" ON "mcp_connection"
  FOR DELETE USING ("user_id" = current_setting('app.user_id', true));
