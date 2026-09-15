-- ============================================================
-- Migration: 004_add_is_default_to_terms.sql
-- Add is_default column to termcat_terms table
-- Run this script in your Supabase SQL Editor
-- ============================================================

ALTER TABLE termcat_terms ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

-- Set 'Term 1' (or first active term) as default if no default term exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM termcat_terms WHERE is_default = TRUE) THEN
    UPDATE termcat_terms SET is_default = TRUE WHERE name = 'Term 1';
    IF NOT FOUND THEN
      UPDATE termcat_terms SET is_default = TRUE WHERE id = (SELECT id FROM termcat_terms WHERE is_active = TRUE ORDER BY sort_order LIMIT 1);
    END IF;
  END IF;
END $$;
