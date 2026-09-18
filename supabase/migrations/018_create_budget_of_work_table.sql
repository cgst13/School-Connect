-- Migration: 018_create_budget_of_work_table.sql
-- Dedicated Supabase table for DepEd Budget of Work (BOW) Competencies

CREATE TABLE IF NOT EXISTS sc_budget_of_work (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade_number INTEGER CHECK (grade_number BETWEEN 1 AND 12),
  learning_area_name TEXT NOT NULL,
  term_name TEXT NOT NULL,
  code TEXT,
  domain_strand TEXT NOT NULL DEFAULT 'General',
  competency_description TEXT NOT NULL,
  target_week TEXT DEFAULT 'Week 1-2',
  target_days INTEGER DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_sc_bow_grade ON sc_budget_of_work(grade_number);
CREATE INDEX IF NOT EXISTS idx_sc_bow_learning_area ON sc_budget_of_work(learning_area_name);
CREATE INDEX IF NOT EXISTS idx_sc_bow_term ON sc_budget_of_work(term_name);
CREATE INDEX IF NOT EXISTS idx_sc_bow_active ON sc_budget_of_work(is_active);

-- Enable RLS
ALTER TABLE sc_budget_of_work ENABLE ROW LEVEL SECURITY;

-- RLS Policies for anon and authenticated users
DROP POLICY IF EXISTS "Allow public read access to budget of work" ON sc_budget_of_work;
DROP POLICY IF EXISTS "Allow authenticated full access to budget of work" ON sc_budget_of_work;
DROP POLICY IF EXISTS "Allow all for sc_budget_of_work" ON sc_budget_of_work;

CREATE POLICY "Allow all for sc_budget_of_work"
  ON sc_budget_of_work FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
