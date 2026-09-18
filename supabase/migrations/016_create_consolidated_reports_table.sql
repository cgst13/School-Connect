-- Create Consolidated Reports Storage Table
CREATE TABLE IF NOT EXISTS termcat_consolidated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  school_year_id UUID REFERENCES sc_school_years(id) ON DELETE CASCADE,
  term_id UUID REFERENCES sc_terms(id) ON DELETE CASCADE,
  level_type TEXT NOT NULL DEFAULT 'all',
  grade_level_id UUID REFERENCES sc_grade_levels(id) ON DELETE SET NULL,
  learning_area_id UUID REFERENCES sc_learning_areas(id) ON DELETE SET NULL,
  total_schools_included INTEGER NOT NULL DEFAULT 0,
  total_submissions_count INTEGER NOT NULL DEFAULT 0,
  total_learners_count INTEGER NOT NULL DEFAULT 0,
  average_mps NUMERIC(5, 2),
  consolidated_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES sc_admin_profiles(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE termcat_consolidated_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for termcat_consolidated_reports" ON termcat_consolidated_reports;
CREATE POLICY "Allow all for termcat_consolidated_reports"
  ON termcat_consolidated_reports FOR ALL
  USING (true) WITH CHECK (true);
