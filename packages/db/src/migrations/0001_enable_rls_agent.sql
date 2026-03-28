-- Enable Row-Level Security on the agent table
ALTER TABLE "agent" ENABLE ROW LEVEL SECURITY;

-- Force RLS even for the table owner (prevents bypassing in dev)
ALTER TABLE "agent" FORCE ROW LEVEL SECURITY;

-- Policy: users can only SELECT their own agents
CREATE POLICY "agent_select_own" ON "agent"
  FOR SELECT
  USING ("user_id" = current_setting('app.user_id', true));

-- Policy: users can only INSERT agents for themselves
CREATE POLICY "agent_insert_own" ON "agent"
  FOR INSERT
  WITH CHECK ("user_id" = current_setting('app.user_id', true));

-- Policy: users can only UPDATE their own agents
CREATE POLICY "agent_update_own" ON "agent"
  FOR UPDATE
  USING ("user_id" = current_setting('app.user_id', true));

-- Policy: users can only DELETE their own agents
CREATE POLICY "agent_delete_own" ON "agent"
  FOR DELETE
  USING ("user_id" = current_setting('app.user_id', true));
