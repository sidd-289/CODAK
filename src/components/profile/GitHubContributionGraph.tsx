'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  GitHubContributionCalendar,
  GitHubContributionDay,
  GitHubCommitItem,
} from '@/types/codingProfiles';
import {
  GitCommit,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Flame,
  Trophy,
  Calendar,
} from 'lucide-react';
import { cleanHandle } from '@/lib/external-profiles/fetchers';
import {
  calculateGitHubStreak,
  formatStreakRange,
} from '@/lib/external-profiles/githubStreak';

interface GitHubContributionGraphProps {
  calendar?: GitHubContributionCalendar | null;
  githubUsername?: string | null;
  commits?: GitHubCommitItem[];
  onRefresh?: () => Promise<void>;
  isSyncing?: boolean;
  onOpenConnectModal?: () => void;
}

export function GitHubContributionGraph({
  calendar,
  githubUsername,
  commits = [],
  onRefresh,
  isSyncing = false,
  onOpenConnectModal,
}: GitHubContributionGraphProps) {
  const [mounted, setMounted] = useState(false);
  const [streakHighlight, setStreakHighlight] = useState<'current' | 'longest' | null>(null);
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    count: number;
    commits: GitHubCommitItem[];
    x: number;
    y: number;
  } | null>(null);
  const [selectedDay, setSelectedDay] = useState<{
    date: string;
    count: number;
    commits: GitHubCommitItem[];
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cleanUser = cleanHandle(githubUsername);
  const days = calendar?.days || [];
  const totalContributions = calendar?.totalContributions ?? 0;

  // Real-time calculation of Current Streak, Longest Streak, Active Days, and Consistency
  const streakStats = useMemo(() => {
    return calculateGitHubStreak(days, commits);
  }, [days, commits]);

  // Split the ~365-371 days into columns of 7 days (Sunday = 0 to Saturday = 6)
  const weeks: GitHubContributionDay[][] = [];
  let currentWeek: GitHubContributionDay[] = [];

  // Group into weeks
  days.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === days.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  // Calculate approximate month labels for top header
  const monthLabels: { label: string; weekIndex: number }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, wIdx) => {
    if (week.length > 0) {
      const firstDay = new Date(week[0].date);
      const m = firstDay.getMonth();
      if (m !== lastMonth) {
        lastMonth = m;
        const shortName = firstDay.toLocaleDateString('en-US', { month: 'short' });
        monthLabels.push({ label: shortName, weekIndex: wIdx });
      }
    }
  });

  const getCellColor = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-[#0e4429] border border-[#006d32]/50 hover:ring-1 hover:ring-emerald-400';
      case 2:
        return 'bg-[#006d32] border border-[#26a641]/60 hover:ring-1 hover:ring-emerald-300';
      case 3:
        return 'bg-[#26a641] border border-[#39d353]/70 hover:ring-1 hover:ring-white shadow-sm shadow-emerald-500/20';
      case 4:
        return 'bg-[#39d353] border border-emerald-300 hover:ring-1 hover:ring-white shadow-md shadow-emerald-400/40';
      default:
        return 'bg-[#161b22] border border-zinc-800/80 hover:border-zinc-700';
    }
  };

  const formatDayTooltip = (d: string) => {
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="relative rounded-2xl bg-zinc-950/70 border border-zinc-800/80 p-5 md:p-6 backdrop-blur-xl shadow-2xl overflow-hidden mb-8">
      {/* Header matching GitHub UI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {cleanUser
                ? `${totalContributions.toLocaleString()} contributions in the last year`
                : 'GitHub Contribution Activity'}
            </h3>
            {cleanUser && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                @{cleanUser}
              </span>
            )}
            {cleanUser && days.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setStreakHighlight((prev) => (prev === 'current' ? null : 'current'))
                }
                className={`cursor-pointer inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                  streakStats.currentStreak > 0
                    ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/10 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20 hover:border-amber-400'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                } ${streakHighlight === 'current' ? 'ring-2 ring-amber-400' : ''}`}
                title={
                  streakStats.currentStreak > 0
                    ? `Current streak: ${streakStats.currentStreak} day${streakStats.currentStreak > 1 ? 's' : ''}. Click to highlight on graph.`
                    : 'No active streak. Click to highlight.'
                }
              >
                <Flame
                  className={`w-3.5 h-3.5 ${
                    streakStats.currentStreak > 0
                      ? 'text-amber-400 fill-amber-400 animate-pulse'
                      : 'text-zinc-500'
                  }`}
                />
                <span className="font-mono">
                  {streakStats.currentStreak}d Streak
                </span>
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Public contribution calendar and yearly commit frequency
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {onRefresh && cleanUser && (
            <button
              onClick={onRefresh}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:text-white hover:border-zinc-500 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Graph'}</span>
            </button>
          )}

          {cleanUser ? (
            <a
              href={`https://github.com/${cleanUser}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:text-white hover:border-zinc-500 transition-all font-medium"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
            </a>
          ) : (
            <button
              onClick={onOpenConnectModal}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all"
            >
              Connect GitHub
            </button>
          )}
        </div>
      </div>

      {/* Main Contribution Graph & Streak Counter Container */}
      {cleanUser && days.length > 0 ? (
        <div className="space-y-4">
          {/* Streak Counter Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Card 1: Current Streak */}
            <div
              onClick={() => setStreakHighlight((prev) => (prev === 'current' ? null : 'current'))}
              onMouseEnter={() => setStreakHighlight('current')}
              onMouseLeave={() => setStreakHighlight(null)}
              className={`group relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/10 via-zinc-900/90 to-zinc-950 border p-3.5 sm:p-4 transition-all cursor-pointer ${
                streakHighlight === 'current'
                  ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/20 scale-[1.01]'
                  : 'border-amber-500/30 hover:border-amber-400/60 hover:shadow-md hover:shadow-amber-500/10'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                    <Flame
                      className={`w-3.5 h-3.5 ${
                        streakStats.currentStreak > 0
                          ? 'text-amber-400 fill-amber-400 animate-pulse'
                          : 'text-zinc-500'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] sm:text-xs uppercase font-mono tracking-wider">Current Streak</span>
                </div>
                {streakStats.isStreakActiveToday ? (
                  <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    Active
                  </span>
                ) : streakStats.isMaintainedFromYesterday ? (
                  <span className="text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Due today
                  </span>
                ) : streakStats.currentStreak > 0 ? (
                  <span className="text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                    Active
                  </span>
                ) : (
                  <span className="text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-500 border border-zinc-800">
                    Idle
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                  {streakStats.currentStreak}
                </span>
                <span className="text-xs font-semibold text-zinc-400">
                  {streakStats.currentStreak === 1 ? 'day' : 'days'}
                </span>
              </div>

              <div className="text-[10px] sm:text-[11px] text-zinc-400 font-mono mt-1 truncate">
                {streakStats.currentStreak > 0
                  ? formatStreakRange(streakStats.currentStreakStart, streakStats.currentStreakEnd)
                  : 'Push code today to ignite'}
              </div>

              <div className="text-[9px] text-zinc-500 mt-1 flex items-center justify-between">
                <span>
                  {streakStats.isStreakActiveToday
                    ? 'Committed today'
                    : streakStats.isMaintainedFromYesterday
                    ? 'Yesterday active'
                    : 'Click to highlight'}
                </span>
                <span className="text-[9px] text-amber-400/80 group-hover:underline">Highlight</span>
              </div>
            </div>

            {/* Card 2: Longest Streak */}
            <div
              onClick={() => setStreakHighlight((prev) => (prev === 'longest' ? null : 'longest'))}
              onMouseEnter={() => setStreakHighlight('longest')}
              onMouseLeave={() => setStreakHighlight(null)}
              className={`group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/10 via-zinc-900/90 to-zinc-950 border p-3.5 sm:p-4 transition-all cursor-pointer ${
                streakHighlight === 'longest'
                  ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-500/20 scale-[1.01]'
                  : 'border-emerald-500/30 hover:border-emerald-400/60 hover:shadow-md hover:shadow-emerald-500/10'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[11px] sm:text-xs uppercase font-mono tracking-wider">Longest Streak</span>
                </div>
                <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Record
                </span>
              </div>

              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                  {streakStats.longestStreak}
                </span>
                <span className="text-xs font-semibold text-zinc-400">
                  {streakStats.longestStreak === 1 ? 'day' : 'days'}
                </span>
              </div>

              <div className="text-[10px] sm:text-[11px] text-zinc-400 font-mono mt-1 truncate">
                {streakStats.longestStreak > 0
                  ? formatStreakRange(streakStats.longestStreakStart, streakStats.longestStreakEnd)
                  : 'No streaks recorded'}
              </div>

              <div className="text-[9px] text-zinc-500 mt-1 flex items-center justify-between">
                <span>Personal best</span>
                <span className="text-[9px] text-emerald-400/80 group-hover:underline">Highlight</span>
              </div>
            </div>

            {/* Card 3: Active Days */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-500/10 via-zinc-900/90 to-zinc-950 border border-sky-500/30 p-3.5 sm:p-4 transition-all hover:border-sky-400/50">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                  <div className="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <span className="text-[11px] sm:text-xs uppercase font-mono tracking-wider">Active Days</span>
                </div>
                <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  {streakStats.consistencyPercentage}%
                </span>
              </div>

              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                  {streakStats.totalActiveDays}
                </span>
                <span className="text-xs font-semibold text-zinc-400">
                  / {streakStats.totalRecordedDays} days
                </span>
              </div>

              <div className="text-[10px] sm:text-[11px] text-zinc-400 font-mono mt-1 truncate">
                {streakStats.consistencyPercentage}% commit consistency
              </div>

              <div className="text-[9px] text-zinc-500 mt-1">
                Past 365 days window
              </div>
            </div>

            {/* Card 4: Total Contributions */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 via-zinc-900/90 to-zinc-950 border border-purple-500/30 p-3.5 sm:p-4 transition-all hover:border-purple-400/50">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400">
                  <div className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <GitCommit className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <span className="text-[11px] sm:text-xs uppercase font-mono tracking-wider">Contributions</span>
                </div>
                <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
                  Yearly
                </span>
              </div>

              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                  {totalContributions.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-zinc-400">
                  total
                </span>
              </div>

              <div className="text-[10px] sm:text-[11px] text-zinc-400 font-mono mt-1 truncate">
                {streakStats.totalActiveDays > 0
                  ? `~${(totalContributions / streakStats.totalActiveDays).toFixed(1)} per active day`
                  : '0 per active day'}
              </div>

              <div className="text-[9px] text-zinc-500 mt-1">
                Commits, PRs & reviews
              </div>
            </div>
          </div>

          {/* Interactive Contribution Graph */}
          <div className="rounded-xl border border-zinc-800 bg-[#0d1117] p-4 sm:p-5 overflow-x-auto relative shadow-inner">
            <div className="min-w-[720px] flex flex-col">
              {/* Months Header Row */}
              <div className="flex text-[10px] text-zinc-400 font-mono mb-2 pl-8 relative h-4">
                {monthLabels.map((m, idx) => (
                  <div
                    key={`${m.label}-${idx}`}
                    className="absolute"
                    style={{ left: `calc(${m.weekIndex * 14}px + 2rem)` }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Grid with Day Labels */}
              <div className="flex gap-2">
                {/* Day Labels (Mon, Wed, Fri) */}
                <div className="flex flex-col justify-between text-[9px] text-zinc-500 font-mono h-[98px] py-[2px] pr-1 select-none">
                  <span className="h-[12px]"></span>
                  <span className="h-[12px] leading-3">Mon</span>
                  <span className="h-[12px]"></span>
                  <span className="h-[12px] leading-3">Wed</span>
                  <span className="h-[12px]"></span>
                  <span className="h-[12px] leading-3">Fri</span>
                  <span className="h-[12px]"></span>
                </div>

                {/* Weeks Columns */}
                <div className="flex gap-[3px]">
                  {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-[3px]">
                      {week.map((day) => {
                        const isSelected = selectedDay?.date === day.date;
                        const isCurrentStreakDay = streakStats.currentStreakDates.includes(day.date);
                        const isLongestStreakDay = streakStats.longestStreakDates.includes(day.date);

                        const isHighlighted =
                          (streakHighlight === 'current' && isCurrentStreakDay) ||
                          (streakHighlight === 'longest' && isLongestStreakDay);

                        return (
                          <div
                            key={day.date}
                            onClick={() => {
                              const dayCommits = (commits || []).filter((c) => {
                                if (!c.committedAt) return false;
                                try {
                                  const d = new Date(c.committedAt).toISOString().slice(0, 10);
                                  return d === day.date || c.committedAt.startsWith(day.date);
                                } catch {
                                  return c.committedAt.startsWith(day.date);
                                }
                              });
                              setSelectedDay(
                                isSelected
                                  ? null
                                  : { date: day.date, count: day.count, commits: dayCommits }
                              );
                            }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const dayCommits = (commits || []).filter((c) => {
                                if (!c.committedAt) return false;
                                try {
                                  const d = new Date(c.committedAt).toISOString().slice(0, 10);
                                  return d === day.date || c.committedAt.startsWith(day.date);
                                } catch {
                                  return c.committedAt.startsWith(day.date);
                                }
                              });
                              setHoveredDay({
                                date: day.date,
                                count: day.count,
                                commits: dayCommits,
                                x: rect.left + rect.width / 2,
                                y: rect.top,
                              });
                            }}
                            onMouseLeave={() => setHoveredDay(null)}
                            className={`w-[11px] h-[11px] sm:w-[12px] sm:h-[12px] rounded-[2px] transition-all duration-150 cursor-pointer ${
                              isSelected
                                ? 'ring-2 ring-white scale-125 z-20 shadow-md'
                                : isHighlighted
                                ? streakHighlight === 'current'
                                  ? 'ring-2 ring-amber-400 scale-125 z-10 shadow-md shadow-amber-500/60'
                                  : 'ring-2 ring-emerald-300 scale-125 z-10 shadow-md shadow-emerald-400/60'
                                : 'hover:scale-125'
                            } ${getCellColor(day.level)}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Day Commits Breakdown */}
              {selectedDay && (
                <div className="mt-3 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs animate-in fade-in duration-150">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">
                        {formatDayTooltip(selectedDay.date)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                        {selectedDay.count} contribution{selectedDay.count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedDay(null)}
                      className="text-zinc-500 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-zinc-800"
                    >
                      ✕ Close
                    </button>
                  </div>
                  {selectedDay.commits.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedDay.commits.map((c) => (
                        <div
                          key={c.id || c.shortSha}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-black/50 border border-zinc-800/80"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <GitCommit className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="font-mono text-[10px] text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded shrink-0">
                              {c.repoName.split('/')[1] || c.repoName}
                            </span>
                            <span className="text-zinc-200 truncate">{c.message}</span>
                          </div>
                          <a
                            href={c.commitUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 ml-2 shrink-0"
                          >
                            {c.shortSha}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-400">
                      {selectedDay.count > 0
                        ? `${selectedDay.count} contributions on this day were synced to GitHub.`
                        : 'No commit activity recorded on this day.'}
                    </p>
                  )}
                </div>
              )}

              {/* Bottom Footer: Learn link, streak clear, & Legend */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-400 pt-4 mt-2 border-t border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <a
                    href="https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/why-are-my-contributions-not-showing-up-on-my-profile"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-zinc-300 transition-colors text-[11px]"
                  >
                    Learn how we count contributions
                  </a>
                  {streakHighlight && (
                    <button
                      type="button"
                      onClick={() => setStreakHighlight(null)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 transition-all font-mono"
                    >
                      ✕ Clear {streakHighlight} streak highlight
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
                  <span>Less</span>
                  <div className="w-[11px] h-[11px] rounded-[2px] bg-[#161b22] border border-zinc-800" />
                  <div className="w-[11px] h-[11px] rounded-[2px] bg-[#0e4429] border border-[#006d32]/50" />
                  <div className="w-[11px] h-[11px] rounded-[2px] bg-[#006d32] border border-[#26a641]/60" />
                  <div className="w-[11px] h-[11px] rounded-[2px] bg-[#26a641] border border-[#39d353]/70" />
                  <div className="w-[11px] h-[11px] rounded-[2px] bg-[#39d353] border border-emerald-300" />
                  <span>More</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : cleanUser ? (
        /* User linked but calendar syncing or pending */
        <div className="py-10 flex flex-col items-center justify-center text-center px-4 rounded-xl border border-dashed border-zinc-800 bg-[#0d1117]/50">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 mb-2">
            <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">
            {isSyncing ? 'Syncing Live Heatmap...' : 'Contributions Not Synced Yet'}
          </h4>
          <p className="text-xs text-zinc-400 max-w-sm mb-4">
            Linked to @{cleanUser}. Click below to fetch your public 365-day contribution calendar directly from GitHub.
          </p>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isSyncing}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Contributions Now'}</span>
              </button>
            )}
            <button
              onClick={onOpenConnectModal}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all"
            >
              Edit Username
            </button>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="py-10 flex flex-col items-center justify-center text-center px-4 rounded-xl border border-dashed border-zinc-800 bg-[#0d1117]/50">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 mb-2">
            <GitCommit className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">No GitHub Account Connected</h4>
          <p className="text-xs text-zinc-400 max-w-sm mb-4">
            Link your GitHub username in the profile to display your authentic 365-day contribution calendar.
          </p>
          <button
            onClick={onOpenConnectModal}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all"
          >
            Connect GitHub
          </button>
        </div>
      )}

      {/* Floating Tooltip mounted to document.body via Portal */}
      {mounted && hoveredDay && createPortal(
        <div
          className="pointer-events-none fixed z-[99999] px-3.5 py-2.5 rounded-xl bg-zinc-950/95 text-white border border-zinc-700 shadow-2xl backdrop-blur-md -translate-x-1/2 -translate-y-full -mt-2.5 transition-all animate-in fade-in zoom-in-95 duration-100 min-w-[220px] max-w-[340px]"
          style={{
            left: Math.max(170, Math.min(window.innerWidth - 170, hoveredDay.x)),
            top: hoveredDay.y,
          }}
        >
          <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-zinc-800/80">
            <span className="font-bold text-xs text-emerald-400 font-mono">
              {hoveredDay.count === 0
                ? 'No contributions'
                : `${hoveredDay.count} contribution${hoveredDay.count > 1 ? 's' : ''}`}
            </span>
            <span className="text-[10px] text-zinc-400 font-medium">
              {formatDayTooltip(hoveredDay.date)}
            </span>
          </div>

          {/* Streak Status Pill in Tooltip */}
          {(streakStats.currentStreakDates.includes(hoveredDay.date) ||
            streakStats.longestStreakDates.includes(hoveredDay.date)) && (
            <div className="py-1 flex items-center gap-1.5 text-[10px] font-semibold border-b border-zinc-800/80">
              {streakStats.currentStreakDates.includes(hoveredDay.date) && (
                <span className="text-amber-400 flex items-center gap-1">
                  <Flame className="w-3 h-3 fill-amber-400 text-amber-400" />
                  Current streak ({streakStats.currentStreak}d)
                </span>
              )}
              {streakStats.longestStreakDates.includes(hoveredDay.date) && (
                <span className="text-emerald-400 flex items-center gap-1 ml-auto">
                  <Trophy className="w-3 h-3 text-emerald-400" />
                  Record ({streakStats.longestStreak}d)
                </span>
              )}
            </div>
          )}

          {hoveredDay.commits.length > 0 ? (
            <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
              <div className="text-[9px] uppercase font-mono tracking-wider text-zinc-500">
                Commits on this day ({hoveredDay.commits.length})
              </div>
              {hoveredDay.commits.map((c) => (
                <div key={c.id || c.shortSha} className="flex items-start gap-1.5 text-zinc-300">
                  <GitCommit className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-zinc-200 truncate leading-snug" title={c.message}>
                      {c.message}
                    </p>
                    <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 mt-0.5">
                      <span className="text-sky-400 bg-sky-500/10 px-1 py-0.2 rounded">
                        {c.repoName.split('/')[1] || c.repoName}
                      </span>
                      <span>{c.shortSha}</span>
                    </div>
                  </div>
                </div>
              ))}
              {hoveredDay.count > hoveredDay.commits.length && (
                <div className="text-[9px] text-zinc-500 italic pt-0.5">
                  + {hoveredDay.count - hoveredDay.commits.length} other contribution{hoveredDay.count - hoveredDay.commits.length > 1 ? 's' : ''} (PRs, issues, or reviews)
                </div>
              )}
            </div>
          ) : hoveredDay.count > 0 ? (
            <div className="mt-2 text-[10px] text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{hoveredDay.count} contribution{hoveredDay.count > 1 ? 's' : ''} pushed to GitHub</span>
            </div>
          ) : (
            <div className="mt-1.5 text-[10px] text-zinc-500">
              No commit activity recorded on this day
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
