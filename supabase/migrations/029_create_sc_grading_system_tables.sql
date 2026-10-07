-- Migration 029: Create e-Class Record & Learner Grading Tables
CREATE TABLE IF NOT EXISTS public.sc_class_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.sc_schools(id) ON DELETE CASCADE,
  grade_level_id UUID REFERENCES public.sc_grade_levels(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sc_sections(id) ON DELETE SET NULL,
  learning_area_id UUID REFERENCES public.sc_learning_areas(id) ON DELETE CASCADE,
  school_year TEXT NOT NULL DEFAULT '2026-2027',
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  hps_written_works JSONB DEFAULT '[]'::jsonb,
  hps_performance_tasks JSONB DEFAULT '[]'::jsonb,
  hps_quarterly_assessment NUMERIC DEFAULT 50,
  created_by UUID REFERENCES public.sc_admin_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT sc_class_records_unique UNIQUE (school_id, grade_level_id, section_id, learning_area_id, quarter, school_year)
);

CREATE TABLE IF NOT EXISTS public.sc_learner_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID REFERENCES public.sc_learners(id) ON DELETE CASCADE,
  class_record_id UUID REFERENCES public.sc_class_records(id) ON DELETE SET NULL,
  learning_area_id UUID REFERENCES public.sc_learning_areas(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.sc_schools(id) ON DELETE CASCADE,
  grade_level_id UUID REFERENCES public.sc_grade_levels(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sc_sections(id) ON DELETE SET NULL,
  school_year TEXT NOT NULL DEFAULT '2026-2027',
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  scores_written_works JSONB DEFAULT '[]'::jsonb,
  scores_performance_tasks JSONB DEFAULT '[]'::jsonb,
  score_quarterly_assessment NUMERIC,
  total_ww_score NUMERIC,
  total_pt_score NUMERIC,
  initial_grade NUMERIC,
  quarterly_grade NUMERIC,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT sc_learner_grades_unique UNIQUE (learner_id, learning_area_id, quarter, school_year)
);

-- Enable RLS
ALTER TABLE public.sc_class_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sc_learner_grades ENABLE ROW LEVEL SECURITY;

-- Permissive policies for SchoolConnect authenticated/anon client
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sc_class_records' AND policyname = 'Allow public all access on sc_class_records'
  ) THEN
    CREATE POLICY "Allow public all access on sc_class_records"
      ON public.sc_class_records FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sc_learner_grades' AND policyname = 'Allow public all access on sc_learner_grades'
  ) THEN
    CREATE POLICY "Allow public all access on sc_learner_grades"
      ON public.sc_learner_grades FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
