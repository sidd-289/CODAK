'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { StudentCodingProfilesData } from '@/types/codingProfiles';
import {
  fetchGitHubData,
  fetchCodeforcesData,
  fetchLeetCodeData,
  fetchCodeChefData,
} from '@/lib/external-profiles/fetchers';

// Default mock handles for demo testing
const DEFAULT_DEMO_HANDLES = {
  leetcode: 'aarav_sharma',
  github: 'aarav-sharma-dev',
  codeforces: 'aarav_coder',
  codechef: 'aarav_master',
};

/**
 * 1. Fetch student's external coding profiles and synced commits
 */
export async function getStudentCodingProfilesAction(
  targetStudentId?: string
): Promise<{ success: boolean; profile: StudentCodingProfilesData | null; error?: string }> {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    let studentId = targetStudentId || user?.id;

    const adminClient = createAdminClient();

    // If still no studentId, fallback to first student for demo
    if (!studentId) {
      const { data: demoStudent } = await adminClient
        .from('students')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (demoStudent) {
        studentId = demoStudent.id;
      }
    }

    if (!studentId) {
      return { success: false, profile: null, error: 'No student found' };
    }

    // Query student_coding_profiles table
    const { data: row, error: fetchErr } = await adminClient
      .from('student_coding_profiles')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    if (fetchErr) {
      console.error('Error fetching coding profiles row:', fetchErr);
    }

    if (!row) {
      // Return a default profile with sample handles
      return {
        success: true,
        profile: {
          studentId,
          leetcodeHandle: null,
          githubUsername: null,
          codeforcesHandle: null,
          codechefHandle: null,
          githubStats: null,
          leetcodeStats: null,
          codeforcesStats: null,
          codechefStats: null,
          recentGithubCommits: [],
          lastSyncedAt: null,
        },
      };
    }

    return {
      success: true,
      profile: {
        studentId: row.student_id,
        leetcodeHandle: row.leetcode_handle,
        githubUsername: row.github_username,
        codeforcesHandle: row.codeforces_handle,
        codechefHandle: row.codechef_handle,
        githubStats: row.github_stats && Object.keys(row.github_stats).length > 0 ? row.github_stats : null,
        leetcodeStats: row.leetcode_stats && Object.keys(row.leetcode_stats).length > 0 ? row.leetcode_stats : null,
        codeforcesStats: row.codeforces_stats && Object.keys(row.codeforces_stats).length > 0 ? row.codeforces_stats : null,
        codechefStats: row.codechef_stats && Object.keys(row.codechef_stats).length > 0 ? row.codechef_stats : null,
        recentGithubCommits: Array.isArray(row.recent_github_commits) ? row.recent_github_commits : [],
        lastSyncedAt: row.last_synced_at,
      },
    };
  } catch (err: any) {
    console.error('getStudentCodingProfilesAction exception:', err);
    return { success: false, profile: null, error: err.message || 'Failed to fetch profiles' };
  }
}

/**
 * 2. Save/Update student handles and automatically sync live stats & commits
 */
export async function saveStudentCodingHandlesAction(input: {
  studentId?: string;
  leetcodeHandle?: string | null;
  githubUsername?: string | null;
  codeforcesHandle?: string | null;
  codechefHandle?: string | null;
}): Promise<{ success: boolean; profile?: StudentCodingProfilesData; error?: string }> {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    let studentId = input.studentId || user?.id;

    const adminClient = createAdminClient();

    if (!studentId) {
      const { data: demoStudent } = await adminClient
        .from('students')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (demoStudent) {
        studentId = demoStudent.id;
      }
    }

    if (!studentId) {
      return { success: false, error: 'Unauthorized: Student account required.' };
    }

    const cleanLeetcode = (input.leetcodeHandle || '').trim() || null;
    const cleanGithub = (input.githubUsername || '').trim().replace(/^@/, '') || null;
    const cleanCodeforces = (input.codeforcesHandle || '').trim() || null;
    const cleanCodechef = (input.codechefHandle || '').trim() || null;

    // Fetch stats in parallel for all non-null handles
    const [ghData, cfStats, lcStats, ccStats] = await Promise.all([
      cleanGithub ? fetchGitHubData(cleanGithub) : Promise.resolve(null),
      cleanCodeforces ? fetchCodeforcesData(cleanCodeforces) : Promise.resolve(null),
      cleanLeetcode ? fetchLeetCodeData(cleanLeetcode) : Promise.resolve(null),
      cleanCodechef ? fetchCodeChefData(cleanCodechef) : Promise.resolve(null),
    ]);

    const payload = {
      student_id: studentId,
      leetcode_handle: cleanLeetcode,
      github_username: cleanGithub,
      codeforces_handle: cleanCodeforces,
      codechef_handle: cleanCodechef,
      github_stats: ghData?.stats || {},
      recent_github_commits: ghData?.commits || [],
      codeforces_stats: cfStats || {},
      leetcode_stats: lcStats || {},
      codechef_stats: ccStats || {},
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: upserted, error: upsertErr } = await adminClient
      .from('student_coding_profiles')
      .upsert(payload, { onConflict: 'student_id' })
      .select()
      .single();

    if (upsertErr) {
      console.error('Error saving coding profiles:', upsertErr);
      return { success: false, error: 'Database save failed: ' + upsertErr.message };
    }

    return {
      success: true,
      profile: {
        studentId: upserted.student_id,
        leetcodeHandle: upserted.leetcode_handle,
        githubUsername: upserted.github_username,
        codeforcesHandle: upserted.codeforces_handle,
        codechefHandle: upserted.codechef_handle,
        githubStats: ghData?.stats || null,
        leetcodeStats: lcStats || null,
        codeforcesStats: cfStats || null,
        codechefStats: ccStats || null,
        recentGithubCommits: ghData?.commits || [],
        lastSyncedAt: upserted.last_synced_at,
      },
    };
  } catch (err: any) {
    console.error('saveStudentCodingHandlesAction exception:', err);
    return { success: false, error: err.message || 'Failed to save profiles' };
  }
}

/**
 * 3. Sync and refresh live stats and GitHub commits for existing linked handles
 */
export async function syncStudentCodingProfilesAction(
  targetStudentId?: string
): Promise<{ success: boolean; profile?: StudentCodingProfilesData; error?: string }> {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    let studentId = targetStudentId || user?.id;
    const adminClient = createAdminClient();

    if (!studentId) {
      const { data: demoStudent } = await adminClient
        .from('students')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (demoStudent) {
        studentId = demoStudent.id;
      }
    }

    if (!studentId) {
      return { success: false, error: 'Student not found' };
    }

    // Get current handles
    const { data: current } = await adminClient
      .from('student_coding_profiles')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    const ghHandle = current?.github_username || DEFAULT_DEMO_HANDLES.github;
    const cfHandle = current?.codeforces_handle || DEFAULT_DEMO_HANDLES.codeforces;
    const lcHandle = current?.leetcode_handle || DEFAULT_DEMO_HANDLES.leetcode;
    const ccHandle = current?.codechef_handle || DEFAULT_DEMO_HANDLES.codechef;

    // Fetch refreshed data
    const [ghData, cfStats, lcStats, ccStats] = await Promise.all([
      ghHandle ? fetchGitHubData(ghHandle) : Promise.resolve(null),
      cfHandle ? fetchCodeforcesData(cfHandle) : Promise.resolve(null),
      lcHandle ? fetchLeetCodeData(lcHandle) : Promise.resolve(null),
      ccHandle ? fetchCodeChefData(ccHandle) : Promise.resolve(null),
    ]);

    const payload = {
      student_id: studentId,
      leetcode_handle: lcHandle,
      github_username: ghHandle,
      codeforces_handle: cfHandle,
      codechef_handle: ccHandle,
      github_stats: ghData?.stats || current?.github_stats || {},
      recent_github_commits: ghData?.commits || current?.recent_github_commits || [],
      codeforces_stats: cfStats || current?.codeforces_stats || {},
      leetcode_stats: lcStats || current?.leetcode_stats || {},
      codechef_stats: ccStats || current?.codechef_stats || {},
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateErr } = await adminClient
      .from('student_coding_profiles')
      .upsert(payload, { onConflict: 'student_id' })
      .select()
      .single();

    if (updateErr) {
      console.error('Error syncing coding profiles:', updateErr);
      return { success: false, error: updateErr.message };
    }

    return {
      success: true,
      profile: {
        studentId: updated.student_id,
        leetcodeHandle: updated.leetcode_handle,
        githubUsername: updated.github_username,
        codeforcesHandle: updated.codeforces_handle,
        codechefHandle: updated.codechef_handle,
        githubStats: updated.github_stats && Object.keys(updated.github_stats).length > 0 ? updated.github_stats : null,
        leetcodeStats: updated.leetcode_stats && Object.keys(updated.leetcode_stats).length > 0 ? updated.leetcode_stats : null,
        codeforcesStats: updated.codeforces_stats && Object.keys(updated.codeforces_stats).length > 0 ? updated.codeforces_stats : null,
        codechefStats: updated.codechef_stats && Object.keys(updated.codechef_stats).length > 0 ? updated.codechef_stats : null,
        recentGithubCommits: Array.isArray(updated.recent_github_commits) ? updated.recent_github_commits : [],
        lastSyncedAt: updated.last_synced_at,
      },
    };
  } catch (err: any) {
    console.error('syncStudentCodingProfilesAction exception:', err);
    return { success: false, error: err.message || 'Sync failed' };
  }
}
