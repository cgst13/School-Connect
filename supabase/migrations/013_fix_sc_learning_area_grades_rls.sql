-- ============================================================
-- Migration: 013_fix_sc_learning_area_grades_rls.sql
-- Description: Fix Row-Level Security (RLS) policies for sc_learning_area_grades
-- and ensure full access for web portal admin operations.
-- ============================================================

-- 1. Enable RLS on sc_learning_area_grades
ALTER TABLE IF EXISTS sc_learning_area_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS termcat_learning_area_grades ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies on sc_learning_area_grades and termcat_learning_area_grades
DO $$ 
BEGIN
  -- Drop policies on sc_learning_area_grades
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view learning area grades" ON sc_learning_area_grades';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can manage learning area grades" ON sc_learning_area_grades';
  EXECUTE 'DROP POLICY IF EXISTS "Allow all for learning area grades" ON sc_learning_area_grades';
  EXECUTE 'DROP POLICY IF EXISTS "Allow full access on sc_learning_area_grades" ON sc_learning_area_grades';

  -- Drop policies on legacy termcat_learning_area_grades if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'termcat_learning_area_grades') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can view learning area grades" ON termcat_learning_area_grades';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage learning area grades" ON termcat_learning_area_grades';
    EXECUTE 'DROP POLICY IF EXISTS "Allow all for learning area grades" ON termcat_learning_area_grades';
    EXECUTE 'DROP POLICY IF EXISTS "Allow full access on termcat_learning_area_grades" ON termcat_learning_area_grades';
  END IF;
END $$;

-- 3. Create permissive policy for sc_learning_area_grades
CREATE POLICY "Allow full access on sc_learning_area_grades"
  ON sc_learning_area_grades FOR ALL
  TO anon, authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- 4. Ensure legacy table also has permissive policy if present
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'termcat_learning_area_grades') THEN
    EXECUTE 'CREATE POLICY "Allow full access on termcat_learning_area_grades" ON termcat_learning_area_grades FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;

-- 5. Guarantee full access on all other core master data tables
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sc_learning_areas') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow all for learning areas" ON sc_learning_areas';
    EXECUTE 'DROP POLICY IF EXISTS "Allow full access on sc_learning_areas" ON sc_learning_areas';
    EXECUTE 'CREATE POLICY "Allow full access on sc_learning_areas" ON sc_learning_areas FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sc_grade_levels') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow all for grade levels" ON sc_grade_levels';
    EXECUTE 'DROP POLICY IF EXISTS "Allow full access on sc_grade_levels" ON sc_grade_levels';
    EXECUTE 'CREATE POLICY "Allow full access on sc_grade_levels" ON sc_grade_levels FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sc_schools') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow all for schools" ON sc_schools';
    EXECUTE 'DROP POLICY IF EXISTS "Allow full access on sc_schools" ON sc_schools';
    EXECUTE 'CREATE POLICY "Allow full access on sc_schools" ON sc_schools FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sc_school_years') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow all for school years" ON sc_school_years';
    EXECUTE 'DROP POLICY IF EXISTS "Allow full access on sc_school_years" ON sc_school_years';
    EXECUTE 'CREATE POLICY "Allow full access on sc_school_years" ON sc_school_years FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sc_terms') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow all for terms" ON sc_terms';
    EXECUTE 'DROP POLICY IF EXISTS "Allow full access on sc_terms" ON sc_terms';
    EXECUTE 'CREATE POLICY "Allow full access on sc_terms" ON sc_terms FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;
