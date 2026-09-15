-- ============================================================
-- Migration: 002_rename_tables_to_termcat_prefix.sql
-- Use this script if you have ALREADY executed the earlier schema
-- and need to rename the tables and objects to the 'termcat_' prefix.
-- ============================================================

DO $$
BEGIN

  -- 1. Rename tables if they exist without the prefix
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_profiles') THEN
    ALTER TABLE public.admin_profiles RENAME TO termcat_admin_profiles;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schools') THEN
    ALTER TABLE public.schools RENAME TO termcat_schools;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grade_levels') THEN
    ALTER TABLE public.grade_levels RENAME TO termcat_grade_levels;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'learning_areas') THEN
    ALTER TABLE public.learning_areas RENAME TO termcat_learning_areas;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'learning_area_grades') THEN
    ALTER TABLE public.learning_area_grades RENAME TO termcat_learning_area_grades;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_years') THEN
    ALTER TABLE public.school_years RENAME TO termcat_school_years;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'terms') THEN
    ALTER TABLE public.terms RENAME TO termcat_terms;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ks1_learner_data') THEN
    ALTER TABLE public.ks1_learner_data RENAME TO termcat_ks1_learner_data;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ks2to4_learner_data') THEN
    ALTER TABLE public.ks2to4_learner_data RENAME TO termcat_ks2to4_learner_data;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'competency_summary') THEN
    ALTER TABLE public.competency_summary RENAME TO termcat_competency_summary;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submission_competencies') THEN
    ALTER TABLE public.submission_competencies RENAME TO termcat_submission_competencies;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instructional_difficulty') THEN
    ALTER TABLE public.instructional_difficulty RENAME TO termcat_instructional_difficulty;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_log') THEN
    ALTER TABLE public.audit_log RENAME TO termcat_audit_log;
  END IF;

  -- 2. Rename sequence if exists
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'submission_ref_seq') THEN
    ALTER SEQUENCE submission_ref_seq RENAME TO termcat_submission_ref_seq;
  END IF;

END $$;

-- 3. Create helper function for admin check
CREATE OR REPLACE FUNCTION termcat_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM termcat_admin_profiles
    WHERE id = auth.uid() AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN termcat_is_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create generator function for reference numbers
CREATE OR REPLACE FUNCTION termcat_generate_reference_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_part TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  seq_part := LPAD(NEXTVAL('termcat_submission_ref_seq')::TEXT, 6, '0');
  RETURN 'TC-' || year_part || '-' || seq_part;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_reference_number()
RETURNS TEXT AS $$
BEGIN
  RETURN termcat_generate_reference_number();
END;
$$ LANGUAGE plpgsql;
