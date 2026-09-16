-- ============================================================
-- Migration 005: Enhance Staff Profiles for Plain User Table Auth & Role Scoping
-- Run this in your Supabase SQL Editor
-- ============================================================

ALTER TABLE termcat_admin_profiles
ADD COLUMN IF NOT EXISTS password text DEFAULT 'password123',
ADD COLUMN IF NOT EXISTS teacher_category text,
ADD COLUMN IF NOT EXISTS assigned_school_ids text[],
ADD COLUMN IF NOT EXISTS assigned_grade_ids text[],
ADD COLUMN IF NOT EXISTS district_name text;

-- Create index for email lookup
CREATE INDEX IF NOT EXISTS idx_termcat_admin_profiles_email ON termcat_admin_profiles (email);

-- Insert default admin if table is empty
INSERT INTO termcat_admin_profiles (id, email, password, full_name, role, is_active)
VALUES (
  'admin-default-1',
  'admin@deped.gov.ph',
  'admin123',
  'System Administrator',
  'superadmin',
  TRUE
)
ON CONFLICT (id) DO NOTHING;
