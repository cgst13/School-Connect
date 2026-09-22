-- Migration: 021_add_school_sessions_and_last_seen_to_sc_admin_profiles.sql
-- Add school_sessions, working_hours_preset, and last_seen_at columns to sc_admin_profiles

ALTER TABLE IF EXISTS sc_admin_profiles ADD COLUMN IF NOT EXISTS school_sessions jsonb DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS sc_admin_profiles ADD COLUMN IF NOT EXISTS working_hours_preset text DEFAULT 'option_1';
ALTER TABLE IF EXISTS sc_admin_profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
