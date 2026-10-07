-- Migration 025: Create Learner Information System (sc_learners) table
CREATE TABLE IF NOT EXISTS public.sc_learners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lrn TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  extension_name TEXT,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  birthdate DATE NOT NULL,
  mother_tongue TEXT,
  ip_group TEXT,
  religion TEXT,
  address_house_no TEXT,
  address_street TEXT,
  address_barangay TEXT,
  address_city_municipality TEXT,
  address_province TEXT,
  father_name TEXT,
  mother_maiden_name TEXT,
  guardian_name TEXT,
  guardian_relationship TEXT,
  guardian_contact_no TEXT,
  is_4ps_cct BOOLEAN DEFAULT false NOT NULL,
  is_balik_aral BOOLEAN DEFAULT false NOT NULL,
  is_ecd_alive_sped BOOLEAN DEFAULT false NOT NULL,
  school_id UUID REFERENCES public.sc_schools(id) ON DELETE CASCADE,
  grade_level_id UUID REFERENCES public.sc_grade_levels(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sc_sections(id) ON DELETE SET NULL,
  school_year TEXT DEFAULT '2025-2026',
  status TEXT DEFAULT 'enrolled' NOT NULL CHECK (status IN ('enrolled', 'transferred_in', 'transferred_out', 'dropped', 'promoted', 'graduated')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.sc_learners ENABLE ROW LEVEL SECURITY;

-- Permissive policy for SchoolConnect users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sc_learners' AND policyname = 'Allow public all access on sc_learners'
  ) THEN
    CREATE POLICY "Allow public all access on sc_learners"
      ON public.sc_learners FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
