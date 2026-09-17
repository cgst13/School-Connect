-- Migration: 006_fix_foreign_key_cascades.sql
-- Set ON DELETE SET NULL on foreign key references to termcat_admin_profiles
-- so staff profiles can be deleted cleanly without FK constraint violations.

-- 1. termcat_submissions foreign keys
ALTER TABLE termcat_submissions
  DROP CONSTRAINT IF EXISTS termcat_submissions_reviewed_by_fkey,
  ADD CONSTRAINT termcat_submissions_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES termcat_admin_profiles(id) ON DELETE SET NULL;

ALTER TABLE termcat_submissions
  DROP CONSTRAINT IF EXISTS termcat_submissions_returned_by_fkey,
  ADD CONSTRAINT termcat_submissions_returned_by_fkey
    FOREIGN KEY (returned_by) REFERENCES termcat_admin_profiles(id) ON DELETE SET NULL;

ALTER TABLE termcat_submissions
  DROP CONSTRAINT IF EXISTS termcat_submissions_finalized_by_fkey,
  ADD CONSTRAINT termcat_submissions_finalized_by_fkey
    FOREIGN KEY (finalized_by) REFERENCES termcat_admin_profiles(id) ON DELETE SET NULL;

ALTER TABLE termcat_submissions
  DROP CONSTRAINT IF EXISTS termcat_submissions_last_edited_by_fkey,
  ADD CONSTRAINT termcat_submissions_last_edited_by_fkey
    FOREIGN KEY (last_edited_by) REFERENCES termcat_admin_profiles(id) ON DELETE SET NULL;

-- 2. termcat_audit_log foreign key
ALTER TABLE termcat_audit_log
  DROP CONSTRAINT IF EXISTS termcat_audit_log_admin_id_fkey,
  ADD CONSTRAINT termcat_audit_log_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES termcat_admin_profiles(id) ON DELETE SET NULL;
