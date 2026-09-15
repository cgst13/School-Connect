-- ============================================================
-- TERMCAT Database Schema
-- All tables and system objects are prefixed with 'termcat_'
-- for multi-system distinction in shared Supabase environments.
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE termcat_school_type AS ENUM ('elementary', 'secondary');
CREATE TYPE termcat_key_stage AS ENUM ('ks1', 'ks2', 'ks3', 'ks4');
CREATE TYPE termcat_form_type AS ENUM ('ks1', 'ks2to4');
CREATE TYPE termcat_submission_status AS ENUM ('submitted', 'reviewed', 'returned', 'finalized');
CREATE TYPE termcat_competency_category AS ENUM ('most_learned', 'least_mastered', 'most_difficult_to_teach');
CREATE TYPE termcat_admin_role AS ENUM ('admin', 'superadmin');

-- ============================================================
-- ADMIN PROFILES
-- ============================================================
CREATE TABLE termcat_admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role termcat_admin_role NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SCHOOLS
-- ============================================================
CREATE TABLE termcat_schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  school_type termcat_school_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_termcat_schools_type ON termcat_schools(school_type);
CREATE INDEX idx_termcat_schools_active ON termcat_schools(is_active);
CREATE INDEX idx_termcat_schools_name_trgm ON termcat_schools USING gin(name gin_trgm_ops);

-- ============================================================
-- GRADE LEVELS
-- ============================================================
CREATE TABLE termcat_grade_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  grade_number INTEGER NOT NULL CHECK (grade_number BETWEEN 1 AND 12),
  school_type termcat_school_type NOT NULL,
  key_stage termcat_key_stage NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(grade_number)
);

CREATE INDEX idx_termcat_grade_levels_school_type ON termcat_grade_levels(school_type);
CREATE INDEX idx_termcat_grade_levels_key_stage ON termcat_grade_levels(key_stage);

-- ============================================================
-- LEARNING AREAS
-- ============================================================
CREATE TABLE termcat_learning_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_termcat_learning_areas_active ON termcat_learning_areas(is_active);
CREATE INDEX idx_termcat_learning_areas_name_trgm ON termcat_learning_areas USING gin(name gin_trgm_ops);

-- ============================================================
-- LEARNING AREA GRADE ASSIGNMENTS
-- ============================================================
CREATE TABLE termcat_learning_area_grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learning_area_id UUID NOT NULL REFERENCES termcat_learning_areas(id) ON DELETE CASCADE,
  grade_level_id UUID NOT NULL REFERENCES termcat_grade_levels(id) ON DELETE CASCADE,
  UNIQUE(learning_area_id, grade_level_id)
);

CREATE INDEX idx_termcat_lag_learning_area ON termcat_learning_area_grades(learning_area_id);
CREATE INDEX idx_termcat_lag_grade_level ON termcat_learning_area_grades(grade_level_id);

-- ============================================================
-- SCHOOL YEARS
-- ============================================================
CREATE TABLE termcat_school_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TERMS
-- ============================================================
CREATE TABLE termcat_terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_termcat_terms_sort ON termcat_terms(sort_order);

-- ============================================================
-- TERMCAT SUBMISSIONS
-- ============================================================
CREATE TABLE termcat_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_number TEXT NOT NULL UNIQUE,
  teacher_name TEXT NOT NULL,
  school_id UUID NOT NULL REFERENCES termcat_schools(id),
  grade_level_id UUID NOT NULL REFERENCES termcat_grade_levels(id),
  learning_area_id UUID NOT NULL REFERENCES termcat_learning_areas(id),
  school_year_id UUID NOT NULL REFERENCES termcat_school_years(id),
  term_id UUID NOT NULL REFERENCES termcat_terms(id),
  key_stage termcat_key_stage NOT NULL,
  form_type termcat_form_type NOT NULL,
  status termcat_submission_status NOT NULL DEFAULT 'submitted',
  return_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES termcat_admin_profiles(id),
  returned_at TIMESTAMPTZ,
  returned_by UUID REFERENCES termcat_admin_profiles(id),
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES termcat_admin_profiles(id),
  last_edited_by UUID REFERENCES termcat_admin_profiles(id),
  last_edited_at TIMESTAMPTZ,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_termcat_submissions_ref ON termcat_submissions(reference_number);
CREATE INDEX idx_termcat_submissions_school ON termcat_submissions(school_id);
CREATE INDEX idx_termcat_submissions_grade ON termcat_submissions(grade_level_id);
CREATE INDEX idx_termcat_submissions_la ON termcat_submissions(learning_area_id);
CREATE INDEX idx_termcat_submissions_sy ON termcat_submissions(school_year_id);
CREATE INDEX idx_termcat_submissions_term ON termcat_submissions(term_id);
CREATE INDEX idx_termcat_submissions_status ON termcat_submissions(status);
CREATE INDEX idx_termcat_submissions_ks ON termcat_submissions(key_stage);
CREATE INDEX idx_termcat_submissions_submitted ON termcat_submissions(submitted_at DESC);
CREATE INDEX idx_termcat_submissions_teacher_trgm ON termcat_submissions USING gin(teacher_name gin_trgm_ops);

-- Partial unique index for duplicate detection
-- (teacher, school, grade, learning area, school year, term)
CREATE UNIQUE INDEX idx_termcat_submissions_unique_combo
  ON termcat_submissions(teacher_name, school_id, grade_level_id, learning_area_id, school_year_id, term_id)
  WHERE status != 'returned';

-- ============================================================
-- KS1 LEARNER DATA (Grade 1-3 Performance Levels)
-- ============================================================
CREATE TABLE termcat_ks1_learner_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL UNIQUE REFERENCES termcat_submissions(id) ON DELETE CASCADE,
  total_learners INTEGER NOT NULL DEFAULT 0 CHECK (total_learners >= 0),
  advancing INTEGER NOT NULL DEFAULT 0 CHECK (advancing >= 0),
  benchmarking INTEGER NOT NULL DEFAULT 0 CHECK (benchmarking >= 0),
  connecting INTEGER NOT NULL DEFAULT 0 CHECK (connecting >= 0),
  developing INTEGER NOT NULL DEFAULT 0 CHECK (developing >= 0),
  emerging INTEGER NOT NULL DEFAULT 0 CHECK (emerging >= 0)
);

-- ============================================================
-- KS2-4 LEARNER DATA (Grade 4-12 MPS)
-- ============================================================
CREATE TABLE termcat_ks2to4_learner_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL UNIQUE REFERENCES termcat_submissions(id) ON DELETE CASCADE,
  total_learners INTEGER NOT NULL DEFAULT 0 CHECK (total_learners >= 0),
  mps NUMERIC(5,2) CHECK (mps >= 0 AND mps <= 100)
);

-- ============================================================
-- COMPETENCY SUMMARY (shared KS1 and KS2-4)
-- ============================================================
CREATE TABLE termcat_competency_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL UNIQUE REFERENCES termcat_submissions(id) ON DELETE CASCADE,
  total_intended_competencies INTEGER NOT NULL DEFAULT 0 CHECK (total_intended_competencies >= 0),
  competencies_taught INTEGER NOT NULL DEFAULT 0 CHECK (competencies_taught >= 0),
  competencies_not_taught INTEGER NOT NULL DEFAULT 0 CHECK (competencies_not_taught >= 0),
  reasons_for_untaught TEXT,
  CONSTRAINT chk_termcat_competency_totals
    CHECK (competencies_taught + competencies_not_taught <= total_intended_competencies)
);

-- ============================================================
-- TOP COMPETENCIES
-- ============================================================
CREATE TABLE termcat_submission_competencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES termcat_submissions(id) ON DELETE CASCADE,
  category termcat_competency_category NOT NULL,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 5),
  competency_text TEXT NOT NULL,
  UNIQUE(submission_id, category, rank)
);

CREATE INDEX idx_termcat_competencies_submission ON termcat_submission_competencies(submission_id);
CREATE INDEX idx_termcat_competencies_category ON termcat_submission_competencies(category);

-- ============================================================
-- INSTRUCTIONAL DIFFICULTY
-- ============================================================
CREATE TABLE termcat_instructional_difficulty (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL UNIQUE REFERENCES termcat_submissions(id) ON DELETE CASCADE,
  factors_text TEXT NOT NULL DEFAULT ''
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE termcat_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES termcat_admin_profiles(id),
  admin_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  entity_label TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_termcat_audit_admin ON termcat_audit_log(admin_id);
CREATE INDEX idx_termcat_audit_action ON termcat_audit_log(action);
CREATE INDEX idx_termcat_audit_entity ON termcat_audit_log(entity_type, entity_id);
CREATE INDEX idx_termcat_audit_created ON termcat_audit_log(created_at DESC);

-- ============================================================
-- REFERENCE NUMBER SEQUENCE & GENERATOR
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS termcat_submission_ref_seq START WITH 1;

-- Function to generate reference numbers
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

-- Backward compatibility function
CREATE OR REPLACE FUNCTION generate_reference_number()
RETURNS TEXT AS $$
BEGIN
  RETURN termcat_generate_reference_number();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION & TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION termcat_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_termcat_admin_profiles_updated_at
  BEFORE UPDATE ON termcat_admin_profiles
  FOR EACH ROW EXECUTE FUNCTION termcat_set_updated_at();

CREATE TRIGGER set_termcat_schools_updated_at
  BEFORE UPDATE ON termcat_schools
  FOR EACH ROW EXECUTE FUNCTION termcat_set_updated_at();

CREATE TRIGGER set_termcat_learning_areas_updated_at
  BEFORE UPDATE ON termcat_learning_areas
  FOR EACH ROW EXECUTE FUNCTION termcat_set_updated_at();

CREATE TRIGGER set_termcat_submissions_updated_at
  BEFORE UPDATE ON termcat_submissions
  FOR EACH ROW EXECUTE FUNCTION termcat_set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all TermCat tables
ALTER TABLE termcat_admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE termcat_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE termcat_grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE termcat_learning_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE termcat_learning_area_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE termcat_school_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE termcat_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE termcat_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE termcat_ks1_learner_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE termcat_ks2to4_learner_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE termcat_competency_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE termcat_submission_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE termcat_instructional_difficulty ENABLE ROW LEVEL SECURITY;
ALTER TABLE termcat_audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is an active TermCat admin
CREATE OR REPLACE FUNCTION termcat_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM termcat_admin_profiles
    WHERE id = auth.uid() AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aliased helper for backwards compatibility
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN termcat_is_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------
-- TERMCAT ADMIN PROFILES
-- -------
CREATE POLICY "Admins can view all profiles"
  ON termcat_admin_profiles FOR SELECT
  TO authenticated
  USING (termcat_is_admin());

CREATE POLICY "Admins can update own profile"
  ON termcat_admin_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can insert profiles"
  ON termcat_admin_profiles FOR INSERT
  TO authenticated
  WITH CHECK (termcat_is_admin());

-- -------
-- TERMCAT SCHOOLS - public read, admin write
-- -------
CREATE POLICY "Anyone can view active schools"
  ON termcat_schools FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage schools"
  ON termcat_schools FOR ALL
  TO authenticated
  USING (termcat_is_admin())
  WITH CHECK (termcat_is_admin());

-- -------
-- TERMCAT GRADE LEVELS - public read
-- -------
CREATE POLICY "Anyone can view grade levels"
  ON termcat_grade_levels FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage grade levels"
  ON termcat_grade_levels FOR ALL
  TO authenticated
  USING (termcat_is_admin())
  WITH CHECK (termcat_is_admin());

-- -------
-- TERMCAT LEARNING AREAS - public read
-- -------
CREATE POLICY "Anyone can view active learning areas"
  ON termcat_learning_areas FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage learning areas"
  ON termcat_learning_areas FOR ALL
  TO authenticated
  USING (termcat_is_admin())
  WITH CHECK (termcat_is_admin());

-- -------
-- TERMCAT LEARNING AREA GRADES - public read
-- -------
CREATE POLICY "Anyone can view learning area grades"
  ON termcat_learning_area_grades FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage learning area grades"
  ON termcat_learning_area_grades FOR ALL
  TO authenticated
  USING (termcat_is_admin())
  WITH CHECK (termcat_is_admin());

-- -------
-- TERMCAT SCHOOL YEARS - public read
-- -------
CREATE POLICY "Anyone can view active school years"
  ON termcat_school_years FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage school years"
  ON termcat_school_years FOR ALL
  TO authenticated
  USING (termcat_is_admin())
  WITH CHECK (termcat_is_admin());

-- -------
-- TERMCAT TERMS - public read
-- -------
CREATE POLICY "Anyone can view active terms"
  ON termcat_terms FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage terms"
  ON termcat_terms FOR ALL
  TO authenticated
  USING (termcat_is_admin())
  WITH CHECK (termcat_is_admin());

-- -------
-- TERMCAT SUBMISSIONS - anon INSERT, admin all
-- -------
CREATE POLICY "Anyone can submit"
  ON termcat_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Admins can view all submissions"
  ON termcat_submissions FOR SELECT
  TO authenticated
  USING (termcat_is_admin());

CREATE POLICY "Admins can update submissions"
  ON termcat_submissions FOR UPDATE
  TO authenticated
  USING (termcat_is_admin())
  WITH CHECK (termcat_is_admin());

CREATE POLICY "Admins can delete submissions"
  ON termcat_submissions FOR DELETE
  TO authenticated
  USING (termcat_is_admin());

-- Teacher can view own submission by reference number (for success page)
CREATE POLICY "Anon can view own submission by reference"
  ON termcat_submissions FOR SELECT
  TO anon
  USING (TRUE);

-- -------
-- TERMCAT KS1 LEARNER DATA
-- -------
CREATE POLICY "Anon can insert ks1 data"
  ON termcat_ks1_learner_data FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Admins can manage ks1 data"
  ON termcat_ks1_learner_data FOR ALL
  TO authenticated
  USING (termcat_is_admin())
  WITH CHECK (termcat_is_admin());

CREATE POLICY "Anon can view ks1 data"
  ON termcat_ks1_learner_data FOR SELECT
  TO anon
  USING (TRUE);

-- -------
-- TERMCAT KS2-4 LEARNER DATA
-- -------
CREATE POLICY "Anon can insert ks2to4 data"
  ON termcat_ks2to4_learner_data FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Admins can manage ks2to4 data"
  ON termcat_ks2to4_learner_data FOR ALL
  TO authenticated
  USING (termcat_is_admin())
  WITH CHECK (termcat_is_admin());

CREATE POLICY "Anon can view ks2to4 data"
  ON termcat_ks2to4_learner_data FOR SELECT
  TO anon
  USING (TRUE);

-- -------
-- TERMCAT COMPETENCY SUMMARY
-- -------
CREATE POLICY "Anon can insert competency summary"
  ON termcat_competency_summary FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Admins can manage competency summary"
  ON termcat_competency_summary FOR ALL
  TO authenticated
  USING (termcat_is_admin())
  WITH CHECK (termcat_is_admin());

CREATE POLICY "Anon can view competency summary"
  ON termcat_competency_summary FOR SELECT
  TO anon
  USING (TRUE);

-- -------
-- TERMCAT SUBMISSION COMPETENCIES
-- -------
CREATE POLICY "Anon can insert submission competencies"
  ON termcat_submission_competencies FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Admins can manage submission competencies"
  ON termcat_submission_competencies FOR ALL
  TO authenticated
  USING (termcat_is_admin())
  WITH CHECK (termcat_is_admin());

CREATE POLICY "Anon can view submission competencies"
  ON termcat_submission_competencies FOR SELECT
  TO anon
  USING (TRUE);

-- -------
-- TERMCAT INSTRUCTIONAL DIFFICULTY
-- -------
CREATE POLICY "Anon can insert instructional difficulty"
  ON termcat_instructional_difficulty FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Admins can manage instructional difficulty"
  ON termcat_instructional_difficulty FOR ALL
  TO authenticated
  USING (termcat_is_admin())
  WITH CHECK (termcat_is_admin());

CREATE POLICY "Anon can view instructional difficulty"
  ON termcat_instructional_difficulty FOR SELECT
  TO anon
  USING (TRUE);

-- -------
-- TERMCAT AUDIT LOG
-- -------
CREATE POLICY "Admins can insert audit logs"
  ON termcat_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (termcat_is_admin());

CREATE POLICY "Admins can view audit logs"
  ON termcat_audit_log FOR SELECT
  TO authenticated
  USING (termcat_is_admin());

-- ============================================================
-- SEED DATA
-- ============================================================

-- Grade Levels
INSERT INTO termcat_grade_levels (name, grade_number, school_type, key_stage, is_active) VALUES
  ('Grade 1', 1, 'elementary', 'ks1', TRUE),
  ('Grade 2', 2, 'elementary', 'ks1', TRUE),
  ('Grade 3', 3, 'elementary', 'ks1', TRUE),
  ('Grade 4', 4, 'elementary', 'ks2', TRUE),
  ('Grade 5', 5, 'elementary', 'ks2', TRUE),
  ('Grade 6', 6, 'elementary', 'ks2', TRUE),
  ('Grade 7', 7, 'secondary', 'ks3', TRUE),
  ('Grade 8', 8, 'secondary', 'ks3', TRUE),
  ('Grade 9', 9, 'secondary', 'ks3', TRUE),
  ('Grade 10', 10, 'secondary', 'ks3', TRUE),
  ('Grade 11', 11, 'secondary', 'ks4', TRUE),
  ('Grade 12', 12, 'secondary', 'ks4', TRUE);

-- Schools
INSERT INTO termcat_schools (name, school_type, is_active) VALUES
  ('Concepcion Central Elementary School', 'elementary', TRUE),
  ('San Vicente Elementary School', 'elementary', TRUE),
  ('Dalajican Elementary School', 'elementary', TRUE),
  ('Masadya Elementary School', 'elementary', TRUE),
  ('Masudsud Elementary School', 'elementary', TRUE),
  ('Bakhawan Elementary School', 'elementary', TRUE),
  ('Sampong Elementary School', 'elementary', TRUE),
  ('Calabasahan Elementary School', 'elementary', TRUE),
  ('San Pedro (Agbatang) Elementary School', 'elementary', TRUE),
  ('Concepcion National Highschool', 'secondary', TRUE),
  ('Bakhawan National Highschool', 'secondary', TRUE);

-- School Years
INSERT INTO termcat_school_years (name, is_active) VALUES
  ('2026-2027', TRUE),
  ('2025-2026', FALSE);

-- Terms
INSERT INTO termcat_terms (name, sort_order, is_active) VALUES
  ('Term 1', 1, TRUE),
  ('Term 2', 2, TRUE),
  ('Term 3', 3, TRUE);

-- Learning Areas
INSERT INTO termcat_learning_areas (name, is_active) VALUES
  ('Mother Tongue', TRUE),
  ('Filipino', TRUE),
  ('English', TRUE),
  ('Mathematics', TRUE),
  ('Araling Panlipunan', TRUE),
  ('MAPEH', TRUE),
  ('Edukasyon sa Pagpapakatao (EsP)', TRUE),
  ('Science', TRUE),
  ('EPP / TLE', TRUE),
  ('Reading and Literacy', TRUE),
  ('Good Manners and Right Conduct (GMRC)', TRUE);

-- Assign learning areas to grades
-- Mother Tongue: Grades 1-3
INSERT INTO termcat_learning_area_grades (learning_area_id, grade_level_id)
SELECT la.id, gl.id FROM termcat_learning_areas la, termcat_grade_levels gl
WHERE la.name = 'Mother Tongue' AND gl.grade_number IN (1, 2, 3);

-- Filipino: Grades 1-10
INSERT INTO termcat_learning_area_grades (learning_area_id, grade_level_id)
SELECT la.id, gl.id FROM termcat_learning_areas la, termcat_grade_levels gl
WHERE la.name = 'Filipino' AND gl.grade_number BETWEEN 1 AND 10;

-- English: Grades 1-12
INSERT INTO termcat_learning_area_grades (learning_area_id, grade_level_id)
SELECT la.id, gl.id FROM termcat_learning_areas la, termcat_grade_levels gl
WHERE la.name = 'English' AND gl.grade_number BETWEEN 1 AND 12;

-- Mathematics: Grades 1-12
INSERT INTO termcat_learning_area_grades (learning_area_id, grade_level_id)
SELECT la.id, gl.id FROM termcat_learning_areas la, termcat_grade_levels gl
WHERE la.name = 'Mathematics' AND gl.grade_number BETWEEN 1 AND 12;

-- Araling Panlipunan: Grades 1-10
INSERT INTO termcat_learning_area_grades (learning_area_id, grade_level_id)
SELECT la.id, gl.id FROM termcat_learning_areas la, termcat_grade_levels gl
WHERE la.name = 'Araling Panlipunan' AND gl.grade_number BETWEEN 1 AND 10;

-- MAPEH: Grades 1-10
INSERT INTO termcat_learning_area_grades (learning_area_id, grade_level_id)
SELECT la.id, gl.id FROM termcat_learning_areas la, termcat_grade_levels gl
WHERE la.name = 'MAPEH' AND gl.grade_number BETWEEN 1 AND 10;

-- EsP: Grades 1-10
INSERT INTO termcat_learning_area_grades (learning_area_id, grade_level_id)
SELECT la.id, gl.id FROM termcat_learning_areas la, termcat_grade_levels gl
WHERE la.name = 'Edukasyon sa Pagpapakatao (EsP)' AND gl.grade_number BETWEEN 1 AND 10;

-- Science: Grades 3-12
INSERT INTO termcat_learning_area_grades (learning_area_id, grade_level_id)
SELECT la.id, gl.id FROM termcat_learning_areas la, termcat_grade_levels gl
WHERE la.name = 'Science' AND gl.grade_number BETWEEN 3 AND 12;

-- EPP/TLE: Grades 4-10
INSERT INTO termcat_learning_area_grades (learning_area_id, grade_level_id)
SELECT la.id, gl.id FROM termcat_learning_areas la, termcat_grade_levels gl
WHERE la.name = 'EPP / TLE' AND gl.grade_number BETWEEN 4 AND 10;

-- Reading and Literacy: Grades 1-3
INSERT INTO termcat_learning_area_grades (learning_area_id, grade_level_id)
SELECT la.id, gl.id FROM termcat_learning_areas la, termcat_grade_levels gl
WHERE la.name = 'Reading and Literacy' AND gl.grade_number IN (1, 2, 3);

-- GMRC: Grades 1-6
INSERT INTO termcat_learning_area_grades (learning_area_id, grade_level_id)
SELECT la.id, gl.id FROM termcat_learning_areas la, termcat_grade_levels gl
WHERE la.name = 'Good Manners and Right Conduct (GMRC)' AND gl.grade_number BETWEEN 1 AND 6;
