-- Migration: 007_refactor_table_schema_prefixes.sql
-- Refactor table schema names:
-- Global School Connect Platform tables start with 'sc_'
-- TERMCAT application specific tables retain 'termcat_'

-- 1. Rename Global Platform Tables
ALTER TABLE IF EXISTS termcat_admin_profiles RENAME TO sc_admin_profiles;
ALTER TABLE IF EXISTS termcat_schools RENAME TO sc_schools;
ALTER TABLE IF EXISTS termcat_grade_levels RENAME TO sc_grade_levels;
ALTER TABLE IF EXISTS termcat_learning_areas RENAME TO sc_learning_areas;
ALTER TABLE IF EXISTS termcat_learning_area_grades RENAME TO sc_learning_area_grades;
ALTER TABLE IF EXISTS termcat_school_years RENAME TO sc_school_years;
ALTER TABLE IF EXISTS termcat_terms RENAME TO sc_terms;
ALTER TABLE IF EXISTS termcat_audit_log RENAME TO sc_audit_log;

-- Ensure role column is text type and enhanced columns exist on sc_admin_profiles
ALTER TABLE IF EXISTS sc_admin_profiles ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE IF EXISTS sc_admin_profiles ADD COLUMN IF NOT EXISTS password text DEFAULT 'password123';
ALTER TABLE IF EXISTS sc_admin_profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE IF EXISTS sc_admin_profiles ADD COLUMN IF NOT EXISTS teacher_category text;
ALTER TABLE IF EXISTS sc_admin_profiles ADD COLUMN IF NOT EXISTS assigned_school_ids text[];
ALTER TABLE IF EXISTS sc_admin_profiles ADD COLUMN IF NOT EXISTS assigned_grade_ids text[];
ALTER TABLE IF EXISTS sc_admin_profiles ADD COLUMN IF NOT EXISTS district_name text;

-- 2. Update Foreign Key Constraints on termcat_submissions to point to sc_
ALTER TABLE termcat_submissions
  DROP CONSTRAINT IF EXISTS termcat_submissions_school_id_fkey,
  ADD CONSTRAINT termcat_submissions_school_id_fkey
    FOREIGN KEY (school_id) REFERENCES sc_schools(id);

ALTER TABLE termcat_submissions
  DROP CONSTRAINT IF EXISTS termcat_submissions_grade_level_id_fkey,
  ADD CONSTRAINT termcat_submissions_grade_level_id_fkey
    FOREIGN KEY (grade_level_id) REFERENCES sc_grade_levels(id);

ALTER TABLE termcat_submissions
  DROP CONSTRAINT IF EXISTS termcat_submissions_learning_area_id_fkey,
  ADD CONSTRAINT termcat_submissions_learning_area_id_fkey
    FOREIGN KEY (learning_area_id) REFERENCES sc_learning_areas(id);

ALTER TABLE termcat_submissions
  DROP CONSTRAINT IF EXISTS termcat_submissions_school_year_id_fkey,
  ADD CONSTRAINT termcat_submissions_school_year_id_fkey
    FOREIGN KEY (school_year_id) REFERENCES sc_school_years(id);

ALTER TABLE termcat_submissions
  DROP CONSTRAINT IF EXISTS termcat_submissions_term_id_fkey,
  ADD CONSTRAINT termcat_submissions_term_id_fkey
    FOREIGN KEY (term_id) REFERENCES sc_terms(id);

ALTER TABLE termcat_submissions
  DROP CONSTRAINT IF EXISTS termcat_submissions_reviewed_by_fkey,
  ADD CONSTRAINT termcat_submissions_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES sc_admin_profiles(id) ON DELETE SET NULL;

ALTER TABLE termcat_submissions
  DROP CONSTRAINT IF EXISTS termcat_submissions_returned_by_fkey,
  ADD CONSTRAINT termcat_submissions_returned_by_fkey
    FOREIGN KEY (returned_by) REFERENCES sc_admin_profiles(id) ON DELETE SET NULL;

ALTER TABLE termcat_submissions
  DROP CONSTRAINT IF EXISTS termcat_submissions_finalized_by_fkey,
  ADD CONSTRAINT termcat_submissions_finalized_by_fkey
    FOREIGN KEY (finalized_by) REFERENCES sc_admin_profiles(id) ON DELETE SET NULL;

ALTER TABLE termcat_submissions
  DROP CONSTRAINT IF EXISTS termcat_submissions_last_edited_by_fkey,
  ADD CONSTRAINT termcat_submissions_last_edited_by_fkey
    FOREIGN KEY (last_edited_by) REFERENCES sc_admin_profiles(id) ON DELETE SET NULL;

-- 3. Update Foreign Key Constraints on sc_learning_area_grades
ALTER TABLE sc_learning_area_grades
  DROP CONSTRAINT IF EXISTS termcat_learning_area_grades_learning_area_id_fkey,
  DROP CONSTRAINT IF EXISTS sc_learning_area_grades_learning_area_id_fkey,
  ADD CONSTRAINT sc_learning_area_grades_learning_area_id_fkey
    FOREIGN KEY (learning_area_id) REFERENCES sc_learning_areas(id) ON DELETE CASCADE;

ALTER TABLE sc_learning_area_grades
  DROP CONSTRAINT IF EXISTS termcat_learning_area_grades_grade_level_id_fkey,
  DROP CONSTRAINT IF EXISTS sc_learning_area_grades_grade_level_id_fkey,
  ADD CONSTRAINT sc_learning_area_grades_grade_level_id_fkey
    FOREIGN KEY (grade_level_id) REFERENCES sc_grade_levels(id) ON DELETE CASCADE;

-- 4. Update Foreign Key Constraints on sc_audit_log
ALTER TABLE sc_audit_log
  DROP CONSTRAINT IF EXISTS termcat_audit_log_admin_id_fkey,
  DROP CONSTRAINT IF EXISTS sc_audit_log_admin_id_fkey,
  ADD CONSTRAINT sc_audit_log_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES sc_admin_profiles(id) ON DELETE SET NULL;
