-- Phase 6: Leaderboard indexes
-- Run this on Supabase SQL editor

-- Fast leaderboard queries: top builders by XP
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON profiles(xp DESC);

-- Fast leaderboard queries: top builders by aura
CREATE INDEX IF NOT EXISTS idx_profiles_aura ON profiles(aura DESC);

-- Fast period-based XP aggregation (weekly/monthly leaderboard)
CREATE INDEX IF NOT EXISTS idx_xp_events_created ON xp_events(created_at DESC);
