-- Migration: 020_add_offered_grade_numbers_to_sc_schools.sql
-- Add offered_grade_numbers array column to sc_schools to configure grade levels with enrollees

ALTER TABLE sc_schools ADD COLUMN IF NOT EXISTS offered_grade_numbers INT[];
