-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- PHASE 5b: Profile Identity — display_name, bio, world_messages
-- ─═̷─═̷─ॐ─═̷─═̷─ Run this in Supabase SQL Editor ─═̷─═̷─ॐ─═̷─═̷─
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PROFILE IDENTITY COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. WORLD CHAT MESSAGES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS world_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  world_id text NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  user_avatar text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_world_messages_world ON world_messages(world_id, created_at DESC);

-- RLS
ALTER TABLE world_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read world messages" ON world_messages;
CREATE POLICY "Anyone can read world messages"
  ON world_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own messages" ON world_messages;
CREATE POLICY "Users can insert own messages"
  ON world_messages FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. BACKFILL display_name from existing name (optional comfort)
-- ═══════════════════════════════════════════════════════════════════════════
-- NOTE: We intentionally do NOT backfill display_name.
-- Null display_name = user hasn't completed onboarding = show the modal.
-- Existing users will see it once and set their chosen name.

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. FEEDBACK TABLE (Anorak 0.0.1)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  user_avatar text,
  type text NOT NULL CHECK (type IN ('bug', 'feature')),
  title text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'shipped', 'wontfix')),
  upvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read feedback" ON feedback;
CREATE POLICY "Anyone can read feedback"
  ON feedback FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert feedback" ON feedback;
CREATE POLICY "Users can insert feedback"
  ON feedback FOR INSERT WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. ENABLE REALTIME on world_messages (for live chat)
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this separately in Supabase Dashboard > Database > Replication:
-- ALTER PUBLICATION supabase_realtime ADD TABLE world_messages;
