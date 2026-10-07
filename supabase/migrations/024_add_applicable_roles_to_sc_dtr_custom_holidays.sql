-- Migration: 024_add_applicable_roles_to_sc_dtr_custom_holidays.sql
-- Add applicable_roles column to sc_dtr_custom_holidays table

ALTER TABLE sc_dtr_custom_holidays
ADD COLUMN IF NOT EXISTS applicable_roles JSONB DEFAULT '["teacher", "ao_2", "school_head", "psds"]'::jsonb;
