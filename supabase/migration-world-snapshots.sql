-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
-- WORLD SNAPSHOTS — Never lose a world again
-- ─═̷─═̷─ॐ─═̷─═̷─ Auto-snapshots before every overwrite ─═̷─═̷─ॐ─═̷─═̷─
--
-- Every time a world is saved, the PREVIOUS state is stashed here.
-- Last 20 snapshots kept per world (auto-pruned).
-- Born from the anorak2 tragedy of March 9, 2026. RIP beautiful world.
-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: world_snapshots
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS world_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id text NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  data jsonb NOT NULL,                    -- Full WorldState at time of snapshot
  object_count integer DEFAULT 0,         -- Quick reference: how many objects were in this snapshot
  source text DEFAULT 'auto',             -- 'auto' (pre-save) or 'manual' (user-triggered)
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookup by world_id + time (most recent first)
CREATE INDEX IF NOT EXISTS idx_world_snapshots_world_id
  ON world_snapshots(world_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — Only world owners can access their snapshots
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE world_snapshots ENABLE ROW LEVEL SECURITY;

-- Read: user can see snapshots for worlds they own
CREATE POLICY "Users can read own world snapshots"
  ON world_snapshots FOR SELECT
  USING (
    world_id IN (
      SELECT id FROM worlds WHERE user_id = auth.uid()::text
    )
  );

-- Insert: server-side only (service role), no user RLS needed for writes
-- Delete: user can delete snapshots for their own worlds
CREATE POLICY "Users can delete own world snapshots"
  ON world_snapshots FOR DELETE
  USING (
    world_id IN (
      SELECT id FROM worlds WHERE user_id = auth.uid()::text
    )
  );
