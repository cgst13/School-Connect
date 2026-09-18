-- Migration: 019_add_created_by_name_to_dtr_records.sql
-- Add created_by_name column to sc_dtr_records to indicate generator when proxy generating DTRs

ALTER TABLE sc_dtr_records ADD COLUMN IF NOT EXISTS created_by_name TEXT;
