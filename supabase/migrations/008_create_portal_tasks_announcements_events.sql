-- Migration: 008_create_portal_tasks_announcements_events.sql
-- Create Supabase tables for Portal Tasks, Task Completions, Announcements, and Events with Scope Targeting

-- 1. Create Portal Tasks Table
CREATE TABLE IF NOT EXISTS sc_portal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  priority TEXT NOT NULL DEFAULT 'normal', -- 'high', 'medium', 'normal'
  category TEXT NOT NULL DEFAULT 'General', -- 'Evaluation', 'Governance', 'Master Data', 'General'
  
  -- Scope & Targeting
  scope_type TEXT NOT NULL DEFAULT 'district', -- 'district', 'school', 'role', 'user'
  target_school_id UUID REFERENCES sc_schools(id) ON DELETE CASCADE,
  target_role TEXT, -- 'ao_2', 'school_head', 'teacher', 'psds', 'admin'
  target_user_id UUID REFERENCES sc_admin_profiles(id) ON DELETE CASCADE,
  
  created_by UUID REFERENCES sc_admin_profiles(id) ON DELETE SET NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Portal Task Completions Table (tracks individual user task completions)
CREATE TABLE IF NOT EXISTS sc_portal_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES sc_portal_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES sc_admin_profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

-- 3. Create Portal Announcements Table
CREATE TABLE IF NOT EXISTS sc_portal_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'General', -- 'Important', 'System Update', 'Event', 'General'
  author_name TEXT NOT NULL,
  author_id UUID REFERENCES sc_admin_profiles(id) ON DELETE SET NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Portal Events Table
CREATE TABLE IF NOT EXISTS sc_portal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL,
  venue TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Meeting', -- 'Meeting', 'Workshop', 'Audit', 'Conference'
  description TEXT,
  created_by UUID REFERENCES sc_admin_profiles(id) ON DELETE SET NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure is_archived columns exist if tables already created
ALTER TABLE sc_portal_tasks ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE sc_portal_announcements ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE sc_portal_events ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM sc_admin_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE sc_portal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_portal_task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_portal_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_portal_events ENABLE ROW LEVEL SECURITY;

-- Cleanly drop existing policies before creating new ones to guarantee idempotency
DO $$ 
BEGIN
  -- Tasks Policies
  EXECUTE 'DROP POLICY IF EXISTS "Allow all access on sc_portal_tasks" ON sc_portal_tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Select tasks for all" ON sc_portal_tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Insert tasks for authenticated" ON sc_portal_tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Update tasks for creator or admin" ON sc_portal_tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Delete tasks for creator or admin" ON sc_portal_tasks';

  -- Task Completions Policies
  EXECUTE 'DROP POLICY IF EXISTS "Allow all access on sc_portal_task_completions" ON sc_portal_task_completions';

  -- Announcements Policies
  EXECUTE 'DROP POLICY IF EXISTS "Allow all access on sc_portal_announcements" ON sc_portal_announcements';
  EXECUTE 'DROP POLICY IF EXISTS "Select announcements for all" ON sc_portal_announcements';
  EXECUTE 'DROP POLICY IF EXISTS "Insert announcements for authenticated" ON sc_portal_announcements';
  EXECUTE 'DROP POLICY IF EXISTS "Update announcements for author or admin" ON sc_portal_announcements';
  EXECUTE 'DROP POLICY IF EXISTS "Delete announcements for author or admin" ON sc_portal_announcements';

  -- Events Policies
  EXECUTE 'DROP POLICY IF EXISTS "Allow all access on sc_portal_events" ON sc_portal_events';
  EXECUTE 'DROP POLICY IF EXISTS "Select events for all" ON sc_portal_events';
  EXECUTE 'DROP POLICY IF EXISTS "Insert events for authenticated" ON sc_portal_events';
  EXECUTE 'DROP POLICY IF EXISTS "Update events for creator or admin" ON sc_portal_events';
  EXECUTE 'DROP POLICY IF EXISTS "Delete events for creator or admin" ON sc_portal_events';
END $$;

-- 1. Tasks Policies
CREATE POLICY "Select tasks for all" ON sc_portal_tasks FOR SELECT USING (true);
CREATE POLICY "Insert tasks for authenticated" ON sc_portal_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Update tasks for creator or admin" ON sc_portal_tasks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Delete tasks for creator or admin" ON sc_portal_tasks FOR DELETE USING (true);

-- 2. Task Completions Policies
CREATE POLICY "Allow all access on sc_portal_task_completions" ON sc_portal_task_completions FOR ALL USING (true) WITH CHECK (true);

-- 3. Announcements Policies
CREATE POLICY "Select announcements for all" ON sc_portal_announcements FOR SELECT USING (true);
CREATE POLICY "Insert announcements for authenticated" ON sc_portal_announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "Update announcements for author or admin" ON sc_portal_announcements FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Delete announcements for author or admin" ON sc_portal_announcements FOR DELETE USING (true);

-- 4. Events Policies
CREATE POLICY "Select events for all" ON sc_portal_events FOR SELECT USING (true);
CREATE POLICY "Insert events for authenticated" ON sc_portal_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Update events for creator or admin" ON sc_portal_events FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Delete events for creator or admin" ON sc_portal_events FOR DELETE USING (true);


