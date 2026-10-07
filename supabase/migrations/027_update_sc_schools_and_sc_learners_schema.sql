-- Migration 027: Update sc_schools and sc_learners schema for full SF1 LIS import & real-time sync

-- 1. Enhance sc_schools table with code, region, division, and district columns
ALTER TABLE public.sc_schools ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.sc_schools ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'MIMAROPA';
ALTER TABLE public.sc_schools ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'Romblon';
ALTER TABLE public.sc_schools ADD COLUMN IF NOT EXISTS district TEXT DEFAULT 'Concepcion';

-- 2. Enhance sc_learners table with all SF1 metadata and guardian/address columns
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS grade_level_name TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS section_name TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS age INT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS mother_tongue TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS ip_group TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS religion TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS address_house_no TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS address_barangay TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS address_city_municipality TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS address_province TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS mother_maiden_name TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS guardian_relationship TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS guardian_contact_no TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS is_4ps_cct BOOLEAN DEFAULT false;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS is_balik_aral BOOLEAN DEFAULT false;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS is_ecd_alive_sped BOOLEAN DEFAULT false;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '2025-2026';
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'enrolled';
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE public.sc_learners ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 3. Make non-critical constraints flexible for imported SF1 datasets
ALTER TABLE public.sc_learners ALTER COLUMN birthdate DROP NOT NULL;
ALTER TABLE public.sc_learners ALTER COLUMN lrn DROP NOT NULL;
ALTER TABLE public.sc_learners ALTER COLUMN sex DROP NOT NULL;
ALTER TABLE public.sc_learners ALTER COLUMN is_4ps_cct DROP NOT NULL;
ALTER TABLE public.sc_learners ALTER COLUMN is_balik_aral DROP NOT NULL;
ALTER TABLE public.sc_learners ALTER COLUMN is_ecd_alive_sped DROP NOT NULL;

-- 4. Drop rigid Foreign Key constraints if present so learners can save even if FK tables differ in UUIDs
ALTER TABLE public.sc_learners DROP CONSTRAINT IF EXISTS sc_learners_school_id_fkey;
ALTER TABLE public.sc_learners DROP CONSTRAINT IF EXISTS sc_learners_grade_level_id_fkey;
ALTER TABLE public.sc_learners DROP CONSTRAINT IF EXISTS sc_learners_section_id_fkey;

-- 5. Create optional UNIQUE index on LRN for fast upserts & matching
CREATE UNIQUE INDEX IF NOT EXISTS sc_learners_lrn_idx ON public.sc_learners(lrn) WHERE lrn IS NOT NULL AND lrn <> '';

-- 6. Ensure RLS Policy on sc_schools and sc_learners allows public read/write
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sc_schools') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow full access on sc_schools" ON public.sc_schools';
    EXECUTE 'CREATE POLICY "Allow full access on sc_schools" ON public.sc_schools FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sc_learners') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow public all access on sc_learners" ON public.sc_learners';
    EXECUTE 'CREATE POLICY "Allow public all access on sc_learners" ON public.sc_learners FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE)';
  END IF;
END $$;
