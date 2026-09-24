-- Migration 023: Create Class / School Sections table
CREATE TABLE IF NOT EXISTS public.sc_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school_id UUID NOT NULL REFERENCES public.sc_schools(id) ON DELETE CASCADE,
  grade_level_id UUID NOT NULL REFERENCES public.sc_grade_levels(id) ON DELETE CASCADE,
  track_strand TEXT,
  adviser_name TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(school_id, grade_level_id, name)
);

-- Enable RLS
ALTER TABLE public.sc_sections ENABLE ROW LEVEL SECURITY;

-- Permissive policy for SchoolConnect users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sc_sections' AND policyname = 'Allow public all access on sc_sections'
  ) THEN
    CREATE POLICY "Allow public all access on sc_sections"
      ON public.sc_sections FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
