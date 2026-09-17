-- ============================================================
-- Migration 005: Enhance Staff Profiles for Plain User Table Auth & Role Scoping
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Drop FK constraint on auth.users(id) if decoupling for plain user table auth
ALTER TABLE termcat_admin_profiles
DROP CONSTRAINT IF EXISTS termcat_admin_profiles_id_fkey;

ALTER TABLE termcat_admin_profiles
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Convert role column type from enum to text to allow teacher, psds, principal, etc.
ALTER TABLE termcat_admin_profiles
ALTER COLUMN role TYPE text USING role::text;

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
  '00000000-0000-0000-0000-000000000001',
  'admin@deped.gov.ph',
  'admin123',
  'System Administrator',
  'superadmin',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- RLS POLICIES FOR USER TABLE AUTH
-- ============================================================

-- 1. termcat_admin_profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON termcat_admin_profiles;
DROP POLICY IF EXISTS "Admins can update own profile" ON termcat_admin_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON termcat_admin_profiles;
DROP POLICY IF EXISTS "Allow all for admin profiles" ON termcat_admin_profiles;

CREATE POLICY "Allow all for admin profiles"
  ON termcat_admin_profiles FOR ALL
  TO anon, authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- 2. termcat_audit_log
DROP POLICY IF EXISTS "Admins can insert audit logs" ON termcat_audit_log;
DROP POLICY IF EXISTS "Admins can view audit logs" ON termcat_audit_log;
DROP POLICY IF EXISTS "Allow all for audit logs" ON termcat_audit_log;

CREATE POLICY "Allow all for audit logs"
  ON termcat_audit_log FOR ALL
  TO anon, authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- 3. termcat_submissions & master data
DROP POLICY IF EXISTS "Admins can view all submissions" ON termcat_submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON termcat_submissions;
DROP POLICY IF EXISTS "Admins can delete submissions" ON termcat_submissions;
DROP POLICY IF EXISTS "Allow all for submissions" ON termcat_submissions;

CREATE POLICY "Allow all for submissions"
  ON termcat_submissions FOR ALL
  TO anon, authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- 4. Allow management for master data tables
DROP POLICY IF EXISTS "Allow all for schools" ON termcat_schools;
CREATE POLICY "Allow all for schools" ON termcat_schools FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow all for grade levels" ON termcat_grade_levels;
CREATE POLICY "Allow all for grade levels" ON termcat_grade_levels FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow all for learning areas" ON termcat_learning_areas;
CREATE POLICY "Allow all for learning areas" ON termcat_learning_areas FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow all for school years" ON termcat_school_years;
CREATE POLICY "Allow all for school years" ON termcat_school_years FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow all for terms" ON termcat_terms;
CREATE POLICY "Allow all for terms" ON termcat_terms FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);


