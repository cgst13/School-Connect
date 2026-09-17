-- Migration: 009_add_reminder_days_to_portal_tasks.sql
-- Add reminder_days_before column to sc_portal_tasks table

ALTER TABLE sc_portal_tasks 
ADD COLUMN IF NOT EXISTS reminder_days_before INTEGER DEFAULT 3;
