-- Migration: 012_create_dtr_system_tables.sql
-- Create Supabase tables for Civil Service Form No. 48 DTR Generator (Records, Custom Holidays, User Configs)

-- 1. DTR Records Table
CREATE TABLE IF NOT EXISTS sc_dtr_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID REFERENCES sc_admin_profiles(id) ON DELETE SET NULL,
  employee_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teacher', -- 'teacher', 'ao_2', 'school_head', 'psds'
  month INT NOT NULL,
  year INT NOT NULL,
  official_hours_text TEXT,
  school_head_name TEXT,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sc_dtr_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access on sc_dtr_records" ON sc_dtr_records FOR ALL USING (true) WITH CHECK (true);

-- Index for fast query by year/month/employee
CREATE INDEX IF NOT EXISTS idx_sc_dtr_records_year_month ON sc_dtr_records(year, month);
CREATE INDEX IF NOT EXISTS idx_sc_dtr_records_employee ON sc_dtr_records(employee_name);

-- 2. DTR Custom Local Holidays Table
CREATE TABLE IF NOT EXISTS sc_dtr_custom_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID REFERENCES sc_admin_profiles(id) ON DELETE SET NULL,
  date_str TEXT NOT NULL, -- "MM-DD" or "YYYY-MM-DD"
  title TEXT NOT NULL,
  is_recurring BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sc_dtr_custom_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access on sc_dtr_custom_holidays" ON sc_dtr_custom_holidays FOR ALL USING (true) WITH CHECK (true);

-- 3. DTR User Configs Table
CREATE TABLE IF NOT EXISTS sc_dtr_user_configs (
  user_id UUID PRIMARY KEY REFERENCES sc_admin_profiles(id) ON DELETE CASCADE,
  employee_name TEXT,
  dtr_target_role TEXT,
  school_head_name TEXT,
  official_hours_text TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sc_dtr_user_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access on sc_dtr_user_configs" ON sc_dtr_user_configs FOR ALL USING (true) WITH CHECK (true);
