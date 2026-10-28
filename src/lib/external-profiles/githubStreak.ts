import { GitHubContributionDay, GitHubCommitItem } from '@/types/codingProfiles';

export interface GitHubStreakStats {
  currentStreak: number;
  currentStreakStart: string | null;
  currentStreakEnd: string | null;
  isStreakActiveToday: boolean;
  isMaintainedFromYesterday: boolean;
  longestStreak: number;
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
  totalContributions: number;
  totalActiveDays: number;
  totalRecordedDays: number;
  consistencyPercentage: number;
  currentStreakDates: string[];
  longestStreakDates: string[];
}

/**
 * Parses YYYY-MM-DD into a UTC millisecond timestamp
 */
export function parseUtcYmd(dateStr: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 0;
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

/**
 * Returns difference in full days (d2 - d1)
 */
export function daysBetween(d1Str: string, d2Str: string): number {
  const ms1 = parseUtcYmd(d1Str);
  const ms2 = parseUtcYmd(d2Str);
  return Math.round((ms2 - ms1) / (24 * 60 * 60 * 1000));
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
export function formatToYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a streak date range into a user-friendly string (e.g., "Oct 25 – Oct 28")
 */
export function formatStreakRange(start: string | null, end: string | null): string {
  if (!start || !end) return '—';

  try {
    const sDate = new Date(`${start}T00:00:00Z`);
    const eDate = new Date(`${end}T00:00:00Z`);

    const startMonth = sDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const startDay = sDate.getUTCDate();
    const startYear = sDate.getUTCFullYear();

    const endMonth = eDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const endDay = eDate.getUTCDate();
    const endYear = eDate.getUTCFullYear();

    if (start === end) {
      return `${startMonth} ${startDay}, ${startYear}`;
    }

    if (startYear === endYear) {
      if (startMonth === endMonth) {
        return `${startMonth} ${startDay} – ${endDay}, ${endYear}`;
      }
      return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${endYear}`;
    }

    return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;
  } catch {
    return `${start} – ${end}`;
  }
}

interface StreakSegment {
  count: number;
  start: string;
  end: string;
  dates: string[];
}

/**
 * Calculates current streak, longest streak, active days, and consistency
 * from GitHub contribution calendar days and recent commits.
 */
export function calculateGitHubStreak(
  days: GitHubContributionDay[] = [],
  commits: GitHubCommitItem[] = [],
  referenceDate?: Date | string
): GitHubStreakStats {
  if (!days || days.length === 0) {
    return {
      currentStreak: 0,
      currentStreakStart: null,
      currentStreakEnd: null,
      isStreakActiveToday: false,
      isMaintainedFromYesterday: false,
      longestStreak: 0,
      longestStreakStart: null,
      longestStreakEnd: null,
      totalContributions: 0,
      totalActiveDays: 0,
      totalRecordedDays: 0,
      consistencyPercentage: 0,
      currentStreakDates: [],
      longestStreakDates: [],
    };
  }

  // 1. Build a mutable map of date -> contribution count
  const dayMap = new Map<string, { date: string; count: number; level: number }>();
  for (const d of days) {
    if (!d || !d.date) continue;
    const cleanDate = d.date.slice(0, 10);
    dayMap.set(cleanDate, {
      date: cleanDate,
      count: Number(d.count) || 0,
      level: Number(d.level) || 0,
    });
  }

  // 2. Augment with recent commits if today's calendar hasn't cached yet
  for (const c of commits || []) {
    if (!c || !c.committedAt) continue;
    let commitYmd = '';
    try {
      commitYmd = new Date(c.committedAt).toISOString().slice(0, 10);
    } catch {
      if (typeof c.committedAt === 'string' && c.committedAt.length >= 10) {
        commitYmd = c.committedAt.slice(0, 10);
      }
    }

    if (commitYmd) {
      const existing = dayMap.get(commitYmd);
      if (existing) {
        if (existing.count === 0) {
          existing.count = 1;
          existing.level = Math.max(1, existing.level);
        }
      } else {
        dayMap.set(commitYmd, { date: commitYmd, count: 1, level: 1 });
      }
    }
  }

  // 3. Sort entries chronologically ascending
  const sorted = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  let totalContributions = 0;
  let totalActiveDays = 0;

  for (const item of sorted) {
    totalContributions += item.count;
    if (item.count > 0) {
      totalActiveDays++;
    }
  }

  const totalRecordedDays = sorted.length;
  const consistencyPercentage =
    totalRecordedDays > 0
      ? Math.round((totalActiveDays / totalRecordedDays) * 1000) / 10
      : 0;

  // 4. Identify all contiguous active streak segments
  const segments: StreakSegment[] = [];
  let currentSegment: StreakSegment | null = null;

  for (const item of sorted) {
    if (item.count > 0) {
      if (!currentSegment) {
        currentSegment = {
          count: 1,
          start: item.date,
          end: item.date,
          dates: [item.date],
        };
      } else {
        const diff = daysBetween(currentSegment.end, item.date);
        if (diff === 1) {
          currentSegment.count++;
          currentSegment.end = item.date;
          currentSegment.dates.push(item.date);
        } else if (diff === 0) {
          // duplicate date entry, ignore or retain
        } else {
          // Gap of 2+ days: save current segment and start a new one
          segments.push(currentSegment);
          currentSegment = {
            count: 1,
            start: item.date,
            end: item.date,
            dates: [item.date],
          };
        }
      }
    } else {
      if (currentSegment) {
        segments.push(currentSegment);
        currentSegment = null;
      }
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  // 5. Determine Longest Streak
  let longestStreak = 0;
  let longestStreakStart: string | null = null;
  let longestStreakEnd: string | null = null;
  let longestStreakDates: string[] = [];

  for (const seg of segments) {
    if (seg.count > longestStreak) {
      longestStreak = seg.count;
      longestStreakStart = seg.start;
      longestStreakEnd = seg.end;
      longestStreakDates = [...seg.dates];
    }
  }

  // 6. Determine Current Streak relative to reference date (today)
  const now = referenceDate instanceof Date
    ? referenceDate
    : typeof referenceDate === 'string'
    ? new Date(`${referenceDate}T12:00:00Z`)
    : new Date();

  const refLocalYmd = formatToYmd(now);
  const refUtcYmd = now.toISOString().slice(0, 10);

  let currentStreak = 0;
  let currentStreakStart: string | null = null;
  let currentStreakEnd: string | null = null;
  let isStreakActiveToday = false;
  let isMaintainedFromYesterday = false;
  let currentStreakDates: string[] = [];

  if (segments.length > 0) {
    const lastSeg = segments[segments.length - 1];

    const diffLocal = daysBetween(lastSeg.end, refLocalYmd);
    const diffUtc = daysBetween(lastSeg.end, refUtcYmd);
    const minDiff = Math.min(diffLocal, diffUtc);

    if (minDiff <= 0) {
      // Last active day was today (or calendar already includes today/UTC)
      currentStreak = lastSeg.count;
      currentStreakStart = lastSeg.start;
      currentStreakEnd = lastSeg.end;
      isStreakActiveToday = true;
      isMaintainedFromYesterday = false;
      currentStreakDates = [...lastSeg.dates];
    } else if (minDiff === 1) {
      // Last active day was yesterday! Streak is still intact, awaiting today's contribution
      currentStreak = lastSeg.count;
      currentStreakStart = lastSeg.start;
      currentStreakEnd = lastSeg.end;
      isStreakActiveToday = false;
      isMaintainedFromYesterday = true;
      currentStreakDates = [...lastSeg.dates];
    } else {
      // Streak broken (last active contribution was 2 or more days ago)
      currentStreak = 0;
      currentStreakStart = null;
      currentStreakEnd = null;
      isStreakActiveToday = false;
      isMaintainedFromYesterday = false;
      currentStreakDates = [];
    }
  }

  return {
    currentStreak,
    currentStreakStart,
    currentStreakEnd,
    isStreakActiveToday,
    isMaintainedFromYesterday,
    longestStreak,
    longestStreakStart,
    longestStreakEnd,
    totalContributions,
    totalActiveDays,
    totalRecordedDays,
    consistencyPercentage,
    currentStreakDates,
    longestStreakDates,
  };
}

