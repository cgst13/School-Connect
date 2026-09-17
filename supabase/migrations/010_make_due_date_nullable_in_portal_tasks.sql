-- Migration: 010_make_due_date_nullable_in_portal_tasks.sql
-- Allow due_date to be optional / nullable in sc_portal_tasks table

ALTER TABLE sc_portal_tasks ALTER COLUMN due_date DROP NOT NULL;
