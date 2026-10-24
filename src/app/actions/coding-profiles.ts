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

/**
 * 1. Fetch student's external coding profiles and synced commits
 * Returns clean null values if no handles are linked. Zero fake demo data.
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
      // Clean default profile with null handles
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
          githubCalendar: null,
          lastSyncedAt: null,
        },
      };
    }

    return {
      success: true,
      profile: {
        studentId: row.student_id,
        leetcodeHandle: row.leetcode_handle || null,
        githubUsername: row.github_username || null,
        codeforcesHandle: row.codeforces_handle || null,
        codechefHandle: row.codechef_handle || null,
        githubStats: row.github_stats && Object.keys(row.github_stats).length > 0 ? row.github_stats : null,
        leetcodeStats: row.leetcode_stats && Object.keys(row.leetcode_stats).length > 0 ? row.leetcode_stats : null,
        codeforcesStats: row.codeforces_stats && Object.keys(row.codeforces_stats).length > 0 ? row.codeforces_stats : null,
        codechefStats: row.codechef_stats && Object.keys(row.codechef_stats).length > 0 ? row.codechef_stats : null,
        recentGithubCommits: Array.isArray(row.recent_github_commits) ? row.recent_github_commits : [],
        githubCalendar: row.github_calendar && row.github_calendar.days ? row.github_calendar : null,
        lastSyncedAt: row.last_synced_at || null,
      },
    };
  } catch (err: any) {
    console.error('getStudentCodingProfilesAction exception:', err);
    return { success: false, profile: null, error: err.message || 'Failed to fetch profiles' };
  }
}

/**
 * 2. Save/Update student handles and automatically sync real live stats & commits
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

    // Fetch REAL data from each platform in parallel
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
      github_calendar: ghData?.calendar || {},
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
        githubCalendar: ghData?.calendar || null,
        lastSyncedAt: upserted.last_synced_at,
      },
    };
  } catch (err: any) {
    console.error('saveStudentCodingHandlesAction exception:', err);
    return { success: false, error: err.message || 'Failed to save profiles' };
  }
}

/**
 * 3. Sync and refresh live stats, contribution calendar, and GitHub commits for existing linked handles
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

    const ghHandle = current?.github_username || null;
    const cfHandle = current?.codeforces_handle || null;
    const lcHandle = current?.leetcode_handle || null;
    const ccHandle = current?.codechef_handle || null;

    if (!ghHandle && !cfHandle && !lcHandle && !ccHandle) {
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
          githubCalendar: null,
          lastSyncedAt: null,
        },
      };
    }

    // Fetch refreshed REAL data in parallel
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
      github_stats: ghData?.stats || (ghHandle ? current?.github_stats : {}) || {},
      recent_github_commits: ghData?.commits || (ghHandle ? current?.recent_github_commits : []) || [],
      github_calendar: ghData?.calendar || (ghHandle ? current?.github_calendar : {}) || {},
      codeforces_stats: cfStats || (cfHandle ? current?.codeforces_stats : {}) || {},
      leetcode_stats: lcStats || (lcHandle ? current?.leetcode_stats : {}) || {},
      codechef_stats: ccStats || (ccHandle ? current?.codechef_stats : {}) || {},
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
        githubCalendar: updated.github_calendar && updated.github_calendar.days ? updated.github_calendar : null,
        lastSyncedAt: updated.last_synced_at,
      },
    };
  } catch (err: any) {
    console.error('syncStudentCodingProfilesAction exception:', err);
    return { success: false, error: err.message || 'Sync failed' };
  }
}
