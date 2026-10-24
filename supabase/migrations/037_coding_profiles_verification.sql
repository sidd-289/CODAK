-- PHASE 6 MIGRATION: 037_coding_profiles_verification.sql
-- Adds verification challenge tokens and verification status flags for external coding profiles

ALTER TABLE public.student_coding_profiles
ADD COLUMN IF NOT EXISTS verification_token TEXT,
ADD COLUMN IF NOT EXISTS github_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS leetcode_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS codeforces_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS codechef_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Backfill verification token for any existing rows if null
UPDATE public.student_coding_profiles
SET verification_token = 'CODAK-AUTH-' || UPPER(SUBSTRING(MD5(student_id::text) FROM 1 FOR 8))
WHERE verification_token IS NULL;
