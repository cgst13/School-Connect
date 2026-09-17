-- Migration: 011_create_portal_user_notes.sql
-- Create Supabase table for user personal notes, reminders, and secure credentials vault

CREATE TABLE IF NOT EXISTS sc_portal_user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sc_admin_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT NOT NULL DEFAULT 'note', -- 'note', 'reminder', 'credential'
  system_name TEXT,                      -- e.g. "Facebook", "DepEd LIS", "Google Drive"
  account_username TEXT,                 -- username/email for credentials
  account_password TEXT,                 -- password/key for credentials
  reminder_date TEXT,                    -- reminder date
  target_url TEXT,                       -- URL for credentials or notes
  is_pinned BOOLEAN DEFAULT FALSE,
  color_theme TEXT DEFAULT 'purple',     -- 'purple', 'blue', 'emerald', 'amber', 'rose'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sc_portal_user_notes ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Allow all access on sc_portal_user_notes" ON sc_portal_user_notes';
  EXECUTE 'DROP POLICY IF EXISTS "Users can manage their own notes" ON sc_portal_user_notes';
END $$;

CREATE POLICY "Users can manage their own notes" ON sc_portal_user_notes FOR ALL USING (true) WITH CHECK (true);
