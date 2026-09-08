-- ============================================
-- ENABLE ROW-LEVEL SECURITY (RLS)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. ENABLE RLS ON ALL TABLES
ALTER TABLE lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;

-- 2. LAWYERS TABLE - Users can only read themselves or all if admin
CREATE POLICY "users_read_own_lawyer"
  ON lawyers
  FOR SELECT
  USING (
    auth.uid()::text = id
    OR EXISTS (SELECT 1 FROM lawyers WHERE id = auth.uid()::text AND is_admin = true)
  );

-- 3. SCREENING_SUBMISSIONS - Access control by lawyer_id
CREATE POLICY "lawyers_read_own_screenings"
  ON screening_submissions
  FOR SELECT
  USING (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR EXISTS (SELECT 1 FROM lawyers WHERE email = auth.jwt()->>'email' AND is_admin = true)
  );

CREATE POLICY "lawyers_create_own_screenings"
  ON screening_submissions
  FOR INSERT
  WITH CHECK (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
  );

CREATE POLICY "lawyers_update_own_screenings"
  ON screening_submissions
  FOR UPDATE
  USING (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR EXISTS (SELECT 1 FROM lawyers WHERE email = auth.jwt()->>'email' AND is_admin = true)
  );

-- 4. FORMS - Access control by lawyer_id
CREATE POLICY "lawyers_read_own_forms"
  ON forms
  FOR SELECT
  USING (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR EXISTS (SELECT 1 FROM lawyers WHERE email = auth.jwt()->>'email' AND is_admin = true)
  );

CREATE POLICY "lawyers_create_own_forms"
  ON forms
  FOR INSERT
  WITH CHECK (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
  );

CREATE POLICY "lawyers_update_own_forms"
  ON forms
  FOR UPDATE
  USING (
    lawyer_id::text = (SELECT id FROM lawyers WHERE email = auth.jwt()->>'email' LIMIT 1)
    OR EXISTS (SELECT 1 FROM lawyers WHERE email = auth.jwt()->>'email' AND is_admin = true)
  );

-- ============================================
-- DONE! Your data is now secure.
-- Lawyers can only see their own data.
-- Admins can see all data.
-- ============================================
