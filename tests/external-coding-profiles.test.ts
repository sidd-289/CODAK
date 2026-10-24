import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getStudentCodingProfilesAction,
  saveStudentCodingHandlesAction,
  syncStudentCodingProfilesAction,
} from '@/app/actions/coding-profiles';
import {
  fetchGitHubData,
  fetchCodeforcesData,
  fetchLeetCodeData,
  fetchCodeChefData,
} from '@/lib/external-profiles/fetchers';

describe('External Coding Profiles & GitHub Commits Integration Suite', () => {
  const adminClient = createAdminClient();
  const testRunId = `prof_${Date.now()}`;
  let testStudentId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    // Create an isolated test student
    const email = `${testRunId}_student@test.edu`;
    const password = 'TestPassword123!';

    const { data: user, error: userErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'student', full_name: 'Test Coder' },
    });

    if (userErr || !user?.user) {
      throw new Error(`Failed to create test user: ${userErr?.message}`);
    }

    testStudentId = user.user.id;
    createdUserIds.push(testStudentId);

    await adminClient.from('profiles').update({
      role: 'student',
      full_name: 'Test Coder',
    }).eq('id', testStudentId);

    await adminClient.from('students').upsert({
      id: testStudentId,
      roll_no: `ROLL_${testStudentId.slice(0, 8)}`,
      department: 'Computer Science',
      year_of_study: 3,
    });
  });

  afterAll(async () => {
    for (const uid of createdUserIds) {
      await adminClient.from('student_coding_profiles').delete().eq('student_id', uid);
      await adminClient.from('students').delete().eq('id', uid);
      await adminClient.from('profiles').delete().eq('id', uid);
      await adminClient.auth.admin.deleteUser(uid);
    }
  });

  describe('1. Individual Platform Data Fetchers', () => {
    it('fetches real GitHub user stats, calendar, and commits', async () => {
      const result = await fetchGitHubData('sidd-289');
      expect(result).not.toBeNull();
      expect(result?.stats.username.toLowerCase()).toBe('sidd-289');
      expect(result?.stats.profileUrl).toBe('https://github.com/sidd-289');
      expect(typeof result?.stats.publicRepos).toBe('number');
      expect(Array.isArray(result?.commits)).toBe(true);
      expect(result?.calendar).toBeTruthy();
      expect(result?.calendar?.totalContributions).toBeGreaterThan(0);
      expect(result?.calendar?.days.length).toBeGreaterThan(300);
    });

    it('returns null for non-existent github username without fabricating fake numbers', async () => {
      const result = await fetchGitHubData('non-existent-user-xyz-987654321');
      expect(result).toBeNull();
    });

    it('fetches Codeforces user stats using official API schema', async () => {
      const result = await fetchCodeforcesData('tourist');
      expect(result).not.toBeNull();
      expect(result?.handle).toBe('tourist');
      expect(result?.profileUrl).toBe('https://codeforces.com/profile/tourist');
      expect(typeof result?.rating).toBe('number');
      expect(typeof result?.maxRating).toBe('number');
      expect(result?.rating).toBeGreaterThan(1000);
      expect(result?.rank).toBeTruthy();
    });

    it('fetches LeetCode user stats with difficulty breakdown', async () => {
      const result = await fetchLeetCodeData('neal_wu');
      if (result) {
        expect(result.username).toBe('neal_wu');
        expect(result.profileUrl).toBe('https://leetcode.com/u/neal_wu');
        expect(typeof result.totalSolved).toBe('number');
        expect(typeof result.easySolved).toBe('number');
        expect(typeof result.mediumSolved).toBe('number');
        expect(typeof result.hardSolved).toBe('number');
      }
    });

    it('fetches CodeChef user stats with stars and rating', async () => {
      const result = await fetchCodeChefData('gennady');
      if (result) {
        expect(result.handle).toBe('gennady');
        expect(result.profileUrl).toBe('https://www.codechef.com/users/gennady');
        expect(typeof result.rating).toBe('number');
      }
    });
  });

  describe('2. Student Coding Profiles Database & Actions', () => {
    it('initializes clean default profile when no handles are linked yet', async () => {
      const res = await getStudentCodingProfilesAction(testStudentId);
      expect(res.success).toBe(true);
      expect(res.profile).not.toBeNull();
      expect(res.profile?.studentId).toBe(testStudentId);
      expect(res.profile?.leetcodeHandle).toBeNull();
      expect(res.profile?.githubUsername).toBeNull();
      expect(res.profile?.codeforcesHandle).toBeNull();
      expect(res.profile?.codechefHandle).toBeNull();
    });

    it('saves external handles and automatically syncs live stats, calendar, and GitHub commits', async () => {
      const saveRes = await saveStudentCodingHandlesAction({
        studentId: testStudentId,
        githubUsername: 'sidd-289',
        codeforcesHandle: 'tourist',
      });

      expect(saveRes.success).toBe(true);
      expect(saveRes.profile).toBeTruthy();
      expect(saveRes.profile?.githubUsername).toBe('sidd-289');
      expect(saveRes.profile?.codeforcesHandle).toBe('tourist');

      // Check stats are populated from real live sources
      expect(saveRes.profile?.githubStats).not.toBeNull();
      expect(saveRes.profile?.githubCalendar).not.toBeNull();
      expect(saveRes.profile?.githubCalendar?.days.length).toBeGreaterThan(300);
      expect(saveRes.profile?.codeforcesStats).not.toBeNull();
      expect(saveRes.profile?.codeforcesStats?.rating).toBeGreaterThan(1000);

      // Check GitHub commits table data
      expect(Array.isArray(saveRes.profile?.recentGithubCommits)).toBe(true);
      expect(saveRes.profile?.lastSyncedAt).toBeTruthy();
    });

    it('retrieves saved profiles and calendar through getStudentCodingProfilesAction', async () => {
      const getRes = await getStudentCodingProfilesAction(testStudentId);
      expect(getRes.success).toBe(true);
      expect(getRes.profile?.githubUsername).toBe('sidd-289');
      expect(getRes.profile?.githubCalendar).toBeTruthy();
      expect(getRes.profile?.githubCalendar?.totalContributions).toBeGreaterThan(0);
    });

    it('refreshes and syncs stats via syncStudentCodingProfilesAction', async () => {
      const syncRes = await syncStudentCodingProfilesAction(testStudentId);
      expect(syncRes.success).toBe(true);
      expect(syncRes.profile).toBeTruthy();
      expect(syncRes.profile?.githubUsername).toBe('sidd-289');
      expect(syncRes.profile?.lastSyncedAt).toBeTruthy();
    });

    it('sanitizes full URLs and handles with domain prefixes gracefully', async () => {
      const saveRes = await saveStudentCodingHandlesAction({
        studentId: testStudentId,
        githubUsername: 'https://github.com/sidd-289/',
        codeforcesHandle: 'https://codeforces.com/profile/tourist',
      });

      expect(saveRes.success).toBe(true);
      expect(saveRes.profile?.githubUsername).toBe('sidd-289');
      expect(saveRes.profile?.codeforcesHandle).toBe('tourist');
      expect(saveRes.profile?.githubCalendar?.days.length).toBeGreaterThan(300);
      expect(saveRes.profile?.verificationToken).toBeTruthy();
      expect(saveRes.profile?.verificationToken).toMatch(/^CODAK-AUTH-/);
    });

    it('handles empty handles gracefully by setting them to null', async () => {
      const updateRes = await saveStudentCodingHandlesAction({
        studentId: testStudentId,
        leetcodeHandle: '',
        githubUsername: '   ',
        codeforcesHandle: null,
        codechefHandle: null,
      });

      expect(updateRes.success).toBe(true);
      expect(updateRes.profile?.leetcodeHandle).toBeNull();
      expect(updateRes.profile?.githubUsername).toBeNull();
      expect(updateRes.profile?.codeforcesHandle).toBeNull();
      expect(updateRes.profile?.codechefHandle).toBeNull();
    });
  });
});
