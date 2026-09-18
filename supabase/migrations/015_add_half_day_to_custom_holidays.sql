-- Migration: 015_add_half_day_to_custom_holidays.sql
-- Add half day columns to sc_dtr_custom_holidays table

ALTER TABLE sc_dtr_custom_holidays
ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS half_day_session TEXT DEFAULT 'am';
