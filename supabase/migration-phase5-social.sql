-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- PHASE 5: "Can You See My World?" — Social Layer Migration
-- ─═̷─═̷─ॐ─═̷─═̷─ Run this in Supabase SQL Editor ─═̷─═̷─ॐ─═̷─═̷─
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. ADD COLUMNS TO WORLDS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE worlds ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS visit_count integer NOT NULL DEFAULT 0;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS creator_name text;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS creator_avatar text;
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS object_count integer NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ADD COLUMNS TO PROFILES TABLE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aura integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_date date;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. WORLD VOTES TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS world_votes (
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  world_id text NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  vote smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, world_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. XP LEDGER
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS xp_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  xp integer NOT NULL,
  world_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_events_user ON xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_action ON xp_events(user_id, action);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RLS POLICIES
-- (DROP + CREATE to be idempotent — safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════

-- Worlds: allow reading public worlds (alongside existing owner-only policy)
DROP POLICY IF EXISTS "Public worlds are readable by all" ON worlds;
CREATE POLICY "Public worlds are readable by all"
  ON worlds FOR SELECT
  USING (visibility = 'public' OR user_id = auth.uid()::text);

-- World votes RLS
ALTER TABLE world_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all votes" ON world_votes;
CREATE POLICY "Users can read all votes"
  ON world_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own votes" ON world_votes;
CREATE POLICY "Users can insert own votes"
  ON world_votes FOR INSERT WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own votes" ON world_votes;
CREATE POLICY "Users can update own votes"
  ON world_votes FOR UPDATE USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own votes" ON world_votes;
CREATE POLICY "Users can delete own votes"
  ON world_votes FOR DELETE USING (user_id = auth.uid()::text);

-- XP events RLS
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own xp events" ON xp_events;
CREATE POLICY "Users can read own xp events"
  ON xp_events FOR SELECT USING (user_id = auth.uid()::text);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. INDEXES for explorer queries
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_worlds_public ON worlds(visibility, updated_at DESC)
  WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_worlds_visit_count ON worlds(visit_count DESC)
  WHERE visibility = 'public';

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. BACKFILL existing worlds with creator info
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE worlds w
SET creator_name = p.name,
    creator_avatar = p.avatar_url
FROM profiles p
WHERE w.user_id = p.id
  AND w.creator_name IS NULL;
