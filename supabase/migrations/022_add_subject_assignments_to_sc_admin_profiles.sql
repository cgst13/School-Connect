-- ============================================================
-- Migration 022: Add assigned_subject_ids and assigned_grade_subject_ids to sc_admin_profiles
-- Run this script in your Supabase SQL Editor if sc_admin_profiles table is missing these columns
-- ============================================================

ALTER TABLE IF EXISTS sc_admin_profiles
ADD COLUMN IF NOT EXISTS assigned_subject_ids text[],
ADD COLUMN IF NOT EXISTS assigned_grade_subject_ids jsonb,
ADD COLUMN IF NOT EXISTS school_sessions jsonb,
ADD COLUMN IF NOT EXISTS working_hours_preset text DEFAULT 'option_1';

ALTER TABLE IF EXISTS termcat_admin_profiles
ADD COLUMN IF NOT EXISTS assigned_subject_ids text[],
ADD COLUMN IF NOT EXISTS assigned_grade_subject_ids jsonb,
ADD COLUMN IF NOT EXISTS school_sessions jsonb,
ADD COLUMN IF NOT EXISTS working_hours_preset text DEFAULT 'option_1';
