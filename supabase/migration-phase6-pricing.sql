-- migration-phase6-pricing.sql
-- Float credits + dynamic pricing config
-- Run this in Supabase SQL Editor

-- 1. ALTER credits to support fractional values (0.01 resolution)
ALTER TABLE profiles ALTER COLUMN credits TYPE numeric(10,2) USING credits::numeric(10,2);

-- 2. App config table — single source of truth for admin-tunable settings
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config (pricing is public info)
DROP POLICY IF EXISTS "Anyone can read config" ON app_config;
CREATE POLICY "Anyone can read config"
  ON app_config FOR SELECT USING (true);

-- Only service role can write (admin API uses service role)
-- No INSERT/UPDATE policy for anon — admin writes via server-side service role

-- 3. Seed default pricing
INSERT INTO app_config (key, value) VALUES (
  'pricing',
  '{
    "conjure_meshy_preview": 1,
    "conjure_meshy_refine": 1,
    "conjure_tripo_turbo": 0.50,
    "conjure_tripo_draft": 0.50,
    "conjure_tripo_standard": 0.75,
    "conjure_tripo_premium": 1,
    "post_texture": 0.50,
    "post_remesh": 0.25,
    "post_rig": 0.75,
    "post_animate": 0.25,
    "craft": 0.05,
    "terrain": 0.05
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;
