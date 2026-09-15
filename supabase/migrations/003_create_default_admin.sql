-- ============================================================
-- Fix & Setup Administrator Access for TermCat
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Remove the broken manual entry that caused the 500 error
DELETE FROM auth.users WHERE email = 'admin@termcat.deped.gov.ph';

-- 2. If 'admin.termcat@gmail.com' exists, confirm it and assign superadmin profile
UPDATE auth.users
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email = 'admin.termcat@gmail.com';

INSERT INTO termcat_admin_profiles (id, email, full_name, role, is_active)
SELECT id, email, 'System Administrator', 'superadmin', TRUE
FROM auth.users
WHERE email = 'admin.termcat@gmail.com'
ON CONFLICT (id) DO UPDATE SET is_active = TRUE, role = 'superadmin';

-- 3. Automatic Trigger: Whenever a user is created via Supabase Dashboard,
-- automatically add them to termcat_admin_profiles as an active admin!
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.termcat_admin_profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'superadmin',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET is_active = TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_user();
