-- Phase 6.5: 3D Avatars via Ready Player Me
-- Adds avatar_3d_url column to profiles for RPM GLB URLs

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_3d_url TEXT;

-- Comment for clarity
COMMENT ON COLUMN profiles.avatar_3d_url IS 'Ready Player Me GLB URL for 3D avatar rendering in worlds';
