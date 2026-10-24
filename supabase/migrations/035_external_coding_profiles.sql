-- PHASE 6 MIGRATION: 035_external_coding_profiles.sql
-- Integrates External Coding Profiles (LeetCode, GitHub, Codeforces, CodeChef)
-- and stores fetched metrics, stats, and recent GitHub commits.

CREATE TABLE IF NOT EXISTS public.student_coding_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE UNIQUE,
  leetcode_handle TEXT,
  github_username TEXT,
  codeforces_handle TEXT,
  codechef_handle TEXT,
  github_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  leetcode_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  codeforces_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  codechef_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  recent_github_commits JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_coding_profiles_student_id ON public.student_coding_profiles(student_id);

ALTER TABLE public.student_coding_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_coding_profiles_select" ON public.student_coding_profiles;
CREATE POLICY "student_coding_profiles_select"
ON public.student_coding_profiles
FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "student_coding_profiles_insert" ON public.student_coding_profiles;
CREATE POLICY "student_coding_profiles_insert"
ON public.student_coding_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "student_coding_profiles_update" ON public.student_coding_profiles;
CREATE POLICY "student_coding_profiles_update"
ON public.student_coding_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

GRANT SELECT, INSERT, UPDATE ON public.student_coding_profiles TO authenticated;
GRANT SELECT ON public.student_coding_profiles TO anon;
