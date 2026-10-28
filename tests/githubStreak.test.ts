import { describe, it, expect } from 'vitest';
import {
  calculateGitHubStreak,
  daysBetween,
  formatStreakRange,
} from '@/lib/external-profiles/githubStreak';
import { GitHubContributionDay, GitHubCommitItem } from '@/types/codingProfiles';

describe('GitHub Streak Calculations', () => {
  it('correctly calculates difference in days', () => {
    expect(daysBetween('2026-10-25', '2026-10-26')).toBe(1);
    expect(daysBetween('2026-10-25', '2026-10-25')).toBe(0);
    expect(daysBetween('2026-10-26', '2026-10-25')).toBe(-1);
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
  });

  it('formats streak date ranges cleanly', () => {
    expect(formatStreakRange('2026-10-25', '2026-10-28')).toBe('Oct 25 – 28, 2026');
    expect(formatStreakRange('2026-09-30', '2026-10-04')).toBe('Sep 30 – Oct 4, 2026');
    expect(formatStreakRange('2026-10-28', '2026-10-28')).toBe('Oct 28, 2026');
    expect(formatStreakRange(null, null)).toBe('—');
  });

  it('handles empty calendar safely', () => {
    const stats = calculateGitHubStreak([]);
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(0);
    expect(stats.totalContributions).toBe(0);
    expect(stats.totalActiveDays).toBe(0);
  });

  it('detects an active streak ending today', () => {
    const refDate = '2026-10-28';
    const days: GitHubContributionDay[] = [
      { date: '2026-10-24', count: 0, level: 0 },
      { date: '2026-10-25', count: 2, level: 1 },
      { date: '2026-10-26', count: 5, level: 2 },
      { date: '2026-10-27', count: 1, level: 1 },
      { date: '2026-10-28', count: 4, level: 2 },
    ];

    const stats = calculateGitHubStreak(days, [], refDate);
    expect(stats.currentStreak).toBe(4);
    expect(stats.currentStreakStart).toBe('2026-10-25');
    expect(stats.currentStreakEnd).toBe('2026-10-28');
    expect(stats.isStreakActiveToday).toBe(true);
    expect(stats.isMaintainedFromYesterday).toBe(false);
    expect(stats.longestStreak).toBe(4);
    expect(stats.totalContributions).toBe(12);
    expect(stats.totalActiveDays).toBe(4);
    expect(stats.currentStreakDates).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ]);
  });

  it('preserves current streak when active yesterday and waiting for today', () => {
    const refDate = '2026-10-28';
    const days: GitHubContributionDay[] = [
      { date: '2026-10-25', count: 1, level: 1 },
      { date: '2026-10-26', count: 3, level: 2 },
      { date: '2026-10-27', count: 2, level: 1 },
      { date: '2026-10-28', count: 0, level: 0 }, // no commit today yet
    ];

    const stats = calculateGitHubStreak(days, [], refDate);
    expect(stats.currentStreak).toBe(3);
    expect(stats.currentStreakStart).toBe('2026-10-25');
    expect(stats.currentStreakEnd).toBe('2026-10-27');
    expect(stats.isStreakActiveToday).toBe(false);
    expect(stats.isMaintainedFromYesterday).toBe(true);
  });

  it('resets current streak to 0 if last active day was 2+ days ago', () => {
    const refDate = '2026-10-28';
    const days: GitHubContributionDay[] = [
      { date: '2026-10-24', count: 1, level: 1 },
      { date: '2026-10-25', count: 3, level: 2 },
      { date: '2026-10-26', count: 2, level: 1 },
      { date: '2026-10-27', count: 0, level: 0 },
      { date: '2026-10-28', count: 0, level: 0 },
    ];

    const stats = calculateGitHubStreak(days, [], refDate);
    expect(stats.currentStreak).toBe(0);
    expect(stats.isStreakActiveToday).toBe(false);
    expect(stats.isMaintainedFromYesterday).toBe(false);
    expect(stats.longestStreak).toBe(3);
    expect(stats.longestStreakStart).toBe('2026-10-24');
    expect(stats.longestStreakEnd).toBe('2026-10-26');
  });

  it('correctly tracks historical longest streak when current streak is shorter', () => {
    const refDate = '2026-10-28';
    const days: GitHubContributionDay[] = [
      // 5-day streak in June
      { date: '2026-06-10', count: 1, level: 1 },
      { date: '2026-06-11', count: 2, level: 1 },
      { date: '2026-06-12', count: 3, level: 2 },
      { date: '2026-06-13', count: 1, level: 1 },
      { date: '2026-06-14', count: 4, level: 2 },
      // gap
      { date: '2026-06-15', count: 0, level: 0 },
      // 2-day streak today
      { date: '2026-10-27', count: 1, level: 1 },
      { date: '2026-10-28', count: 1, level: 1 },
    ];

    const stats = calculateGitHubStreak(days, [], refDate);
    expect(stats.currentStreak).toBe(2);
    expect(stats.longestStreak).toBe(5);
    expect(stats.longestStreakStart).toBe('2026-06-10');
    expect(stats.longestStreakEnd).toBe('2026-06-14');
  });

  it('augments today from commits if calendar API cache lags', () => {
    const refDate = '2026-10-28';
    const days: GitHubContributionDay[] = [
      { date: '2026-10-27', count: 2, level: 1 },
      { date: '2026-10-28', count: 0, level: 0 }, // calendar shows 0
    ];
    const commits: GitHubCommitItem[] = [
      {
        id: 'abc1234',
        shortSha: 'abc1234',
        message: 'fix: updated hero banner',
        repoName: 'sidd/codak',
        repoUrl: 'https://github.com/sidd/codak',
        commitUrl: 'https://github.com/sidd/codak/commit/abc1234',
        committedAt: '2026-10-28T14:32:00Z', // commit made today!
        authorName: 'sidd',
      },
    ];

    const stats = calculateGitHubStreak(days, commits, refDate);
    expect(stats.currentStreak).toBe(2);
    expect(stats.isStreakActiveToday).toBe(true);
    expect(stats.currentStreakEnd).toBe('2026-10-28');
  });
});

