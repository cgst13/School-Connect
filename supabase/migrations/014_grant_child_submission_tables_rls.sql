-- ============================================================
-- Migration: 014_grant_child_submission_tables_rls.sql
-- Description: Grant full RLS permissions (SELECT, INSERT, UPDATE, DELETE)
-- for all submission child data tables to allow complete web portal operations.
-- ============================================================

-- Enable RLS on all child tables
ALTER TABLE IF EXISTS termcat_ks1_learner_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS termcat_ks2to4_learner_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS termcat_competency_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS termcat_submission_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS termcat_instructional_difficulty ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- 1. termcat_ks1_learner_data
  EXECUTE 'DROP POLICY IF EXISTS "Anon can insert ks1 data" ON termcat_ks1_learner_data';
  EXECUTE 'DROP POLICY IF EXISTS "Anon can view ks1 data" ON termcat_ks1_learner_data';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can manage ks1 data" ON termcat_ks1_learner_data';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all for ks1 learner data" ON termcat_ks1_learner_data';

  -- 2. termcat_ks2to4_learner_data
  EXECUTE 'DROP POLICY IF EXISTS "Anon can insert ks2to4 data" ON termcat_ks2to4_learner_data';
  EXECUTE 'DROP POLICY IF EXISTS "Anon can view ks2to4 data" ON termcat_ks2to4_learner_data';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can manage ks2to4 data" ON termcat_ks2to4_learner_data';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all for ks2to4 learner data" ON termcat_ks2to4_learner_data';

  -- 3. termcat_competency_summary
  EXECUTE 'DROP POLICY IF EXISTS "Anon can insert competency summary" ON termcat_competency_summary';
  EXECUTE 'DROP POLICY IF EXISTS "Anon can view competency summary" ON termcat_competency_summary';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can manage competency summary" ON termcat_competency_summary';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all for competency summary" ON termcat_competency_summary';

  -- 4. termcat_submission_competencies
  EXECUTE 'DROP POLICY IF EXISTS "Anon can insert submission competencies" ON termcat_submission_competencies';
  EXECUTE 'DROP POLICY IF EXISTS "Anon can view submission competencies" ON termcat_submission_competencies';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can manage submission competencies" ON termcat_submission_competencies';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all for submission competencies" ON termcat_submission_competencies';

  -- 5. termcat_instructional_difficulty
  EXECUTE 'DROP POLICY IF EXISTS "Anon can insert instructional difficulty" ON termcat_instructional_difficulty';
  EXECUTE 'DROP POLICY IF EXISTS "Anon can view instructional difficulty" ON termcat_instructional_difficulty';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can manage instructional difficulty" ON termcat_instructional_difficulty';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all for instructional difficulty" ON termcat_instructional_difficulty';
END $$;

-- Create permissive policies allowing full access to anon and authenticated roles
CREATE POLICY "Allow all for ks1 learner data"
  ON termcat_ks1_learner_data FOR ALL
  TO anon, authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "Allow all for ks2to4 learner data"
  ON termcat_ks2to4_learner_data FOR ALL
  TO anon, authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "Allow all for competency summary"
  ON termcat_competency_summary FOR ALL
  TO anon, authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "Allow all for submission competencies"
  ON termcat_submission_competencies FOR ALL
  TO anon, authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "Allow all for instructional difficulty"
  ON termcat_instructional_difficulty FOR ALL
  TO anon, authenticated
  USING (TRUE)
  WITH CHECK (TRUE);
