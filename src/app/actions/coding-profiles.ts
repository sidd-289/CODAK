'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { StudentCodingProfilesData } from '@/types/codingProfiles';
import {
  cleanHandle,
  fetchGitHubData,
  fetchCodeforcesData,
  fetchLeetCodeData,
  fetchCodeChefData,
  verifyPlatformBio,
} from '@/lib/external-profiles/fetchers';

function generateVerificationToken(studentId: string): string {
  const cleanId = studentId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `CODAK-AUTH-${cleanId}`;
}

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

    const defaultToken = generateVerificationToken(studentId);

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
          verificationToken: defaultToken,
          githubVerified: false,
          leetcodeVerified: false,
          codeforcesVerified: false,
          codechefVerified: false,
          verifiedAt: null,
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
        githubCalendar: row.github_calendar && Array.isArray(row.github_calendar.days) ? row.github_calendar : null,
        lastSyncedAt: row.last_synced_at || null,
        verificationToken: row.verification_token || defaultToken,
        githubVerified: !!row.github_verified,
        leetcodeVerified: !!row.leetcode_verified,
        codeforcesVerified: !!row.codeforces_verified,
        codechefVerified: !!row.codechef_verified,
        verifiedAt: row.verified_at || null,
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

    // Always sanitize handle inputs to strip full URLs, domain prefixes, and @ symbols
    const cleanLeetcode = cleanHandle(input.leetcodeHandle);
    const cleanGithub = cleanHandle(input.githubUsername);
    const cleanCodeforces = cleanHandle(input.codeforcesHandle);
    const cleanCodechef = cleanHandle(input.codechefHandle);

    // Fetch existing row to check if handles changed (which resets verification status)
    const { data: existing } = await adminClient
      .from('student_coding_profiles')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    const verificationToken = existing?.verification_token || generateVerificationToken(studentId);

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
      verification_token: verificationToken,
      // If handle changed, reset verification
      github_verified: cleanGithub === existing?.github_username ? (existing?.github_verified ?? false) : false,
      leetcode_verified: cleanLeetcode === existing?.leetcode_handle ? (existing?.leetcode_verified ?? false) : false,
      codeforces_verified: cleanCodeforces === existing?.codeforces_handle ? (existing?.codeforces_verified ?? false) : false,
      codechef_verified: cleanCodechef === existing?.codechef_handle ? (existing?.codechef_verified ?? false) : false,
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
        verificationToken: upserted.verification_token,
        githubVerified: upserted.github_verified,
        leetcodeVerified: upserted.leetcode_verified,
        codeforcesVerified: upserted.codeforces_verified,
        codechefVerified: upserted.codechef_verified,
        verifiedAt: upserted.verified_at,
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

    const ghHandle = cleanHandle(current?.github_username);
    const cfHandle = cleanHandle(current?.codeforces_handle);
    const lcHandle = cleanHandle(current?.leetcode_handle);
    const ccHandle = cleanHandle(current?.codechef_handle);

    const verificationToken = current?.verification_token || generateVerificationToken(studentId);

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
          verificationToken,
          githubVerified: false,
          leetcodeVerified: false,
          codeforcesVerified: false,
          codechefVerified: false,
          verifiedAt: null,
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
      verification_token: verificationToken,
      github_verified: current?.github_verified ?? false,
      leetcode_verified: current?.leetcode_verified ?? false,
      codeforces_verified: current?.codeforces_verified ?? false,
      codechef_verified: current?.codechef_verified ?? false,
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
        githubStats: ghData?.stats || null,
        leetcodeStats: lcStats || null,
        codeforcesStats: cfStats || null,
        codechefStats: ccStats || null,
        recentGithubCommits: ghData?.commits || [],
        githubCalendar: ghData?.calendar || null,
        lastSyncedAt: updated.last_synced_at,
        verificationToken: updated.verification_token,
        githubVerified: updated.github_verified,
        leetcodeVerified: updated.leetcode_verified,
        codeforcesVerified: updated.codeforces_verified,
        codechefVerified: updated.codechef_verified,
        verifiedAt: updated.verified_at,
      },
    };
  } catch (err: any) {
    console.error('syncStudentCodingProfilesAction exception:', err);
    return { success: false, error: err.message || 'Failed to sync profiles' };
  }
}

/**
 * 4. Verify Account Ownership via Bio Challenge Token
 */
export async function verifyCodingAccountAction(input: {
  platform: 'github' | 'leetcode' | 'codeforces' | 'codechef';
  studentId?: string;
}): Promise<{ success: boolean; verified?: boolean; profile?: StudentCodingProfilesData; error?: string }> {
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
      return { success: false, error: 'Unauthorized: Student required.' };
    }

    const { data: current } = await adminClient
      .from('student_coding_profiles')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    if (!current) {
      return { success: false, error: 'No coding profile found. Please link your handles first.' };
    }

    const token = current.verification_token || generateVerificationToken(studentId);
    let handleToVerify: string | null = null;
    let verifiedCol = '';

    switch (input.platform) {
      case 'github':
        handleToVerify = current.github_username;
        verifiedCol = 'github_verified';
        break;
      case 'leetcode':
        handleToVerify = current.leetcode_handle;
        verifiedCol = 'leetcode_verified';
        break;
      case 'codeforces':
        handleToVerify = current.codeforces_handle;
        verifiedCol = 'codeforces_verified';
        break;
      case 'codechef':
        handleToVerify = current.codechef_handle;
        verifiedCol = 'codechef_verified';
        break;
    }

    if (!handleToVerify) {
      return { success: false, error: `No ${input.platform} handle linked yet. Please add it first.` };
    }

    const verifyResult = await verifyPlatformBio(input.platform, handleToVerify, token);

    if (!verifyResult.verified) {
      return {
        success: false,
        verified: false,
        error: verifyResult.error || `Could not find verification code "${token}" on your ${input.platform} profile.`,
      };
    }

    // Update verified flag in DB
    const updates: Record<string, any> = {
      [verifiedCol]: true,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await adminClient
      .from('student_coding_profiles')
      .update(updates)
      .eq('student_id', studentId);

    if (updateErr) {
      return { success: false, error: 'Database update failed: ' + updateErr.message };
    }

    const res = await getStudentCodingProfilesAction(studentId);
    return {
      success: true,
      verified: true,
      profile: res.profile || undefined,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Verification check failed' };
  }
}
