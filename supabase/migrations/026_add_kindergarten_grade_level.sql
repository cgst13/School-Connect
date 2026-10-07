-- Migration 026: Add Kindergarten to sc_grade_levels and termcat_grade_levels
-- 1. Drop existing grade_number constraint (which only allowed 1..12) and allow 0 for Kindergarten
DO $$
BEGIN
  -- Drop constraint on sc_grade_levels if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sc_grade_levels' AND constraint_name = 'termcat_grade_levels_grade_number_check'
  ) THEN
    ALTER TABLE public.sc_grade_levels DROP CONSTRAINT termcat_grade_levels_grade_number_check;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sc_grade_levels' AND constraint_name = 'sc_grade_levels_grade_number_check'
  ) THEN
    ALTER TABLE public.sc_grade_levels DROP CONSTRAINT sc_grade_levels_grade_number_check;
  END IF;

  ALTER TABLE public.sc_grade_levels ADD CONSTRAINT sc_grade_levels_grade_number_check CHECK (grade_number BETWEEN 0 AND 12);

  -- Drop constraint on termcat_grade_levels if it exists as a separate table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'termcat_grade_levels') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'termcat_grade_levels' AND constraint_name = 'termcat_grade_levels_grade_number_check'
    ) THEN
      ALTER TABLE public.termcat_grade_levels DROP CONSTRAINT termcat_grade_levels_grade_number_check;
    END IF;
    ALTER TABLE public.termcat_grade_levels ADD CONSTRAINT termcat_grade_levels_grade_number_check CHECK (grade_number BETWEEN 0 AND 12);
  END IF;
END $$;

-- 2. Insert Kindergarten row (grade_number 0)
INSERT INTO public.sc_grade_levels (id, name, grade_number, school_type, key_stage, is_active)
SELECT '00000000-0000-0000-0000-000000000000', 'Kindergarten', 0, 'elementary', 'ks1', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.sc_grade_levels WHERE LOWER(name) LIKE '%kinder%' OR grade_number = 0
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'termcat_grade_levels') THEN
    INSERT INTO public.termcat_grade_levels (id, name, grade_number, school_type, key_stage, is_active)
    SELECT '00000000-0000-0000-0000-000000000000', 'Kindergarten', 0, 'elementary', 'ks1', TRUE
    WHERE NOT EXISTS (
      SELECT 1 FROM public.termcat_grade_levels WHERE LOWER(name) LIKE '%kinder%' OR grade_number = 0
    );
  END IF;
END $$;
