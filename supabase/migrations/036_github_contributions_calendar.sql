-- PHASE 6 MIGRATION: 036_github_contributions_calendar.sql
-- Adds github_calendar to student_coding_profiles for real GitHub contribution graphs.

ALTER TABLE public.student_coding_profiles
ADD COLUMN IF NOT EXISTS github_calendar JSONB NOT NULL DEFAULT '{}'::jsonb;
