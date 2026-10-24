'use client';

import React, { useState } from 'react';
import { GitHubContributionCalendar, GitHubContributionDay } from '@/types/codingProfiles';
import { GitCommit, ExternalLink, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { cleanHandle } from '@/lib/external-profiles/fetchers';

interface GitHubContributionGraphProps {
  calendar?: GitHubContributionCalendar | null;
  githubUsername?: string | null;
  onRefresh?: () => Promise<void>;
  isSyncing?: boolean;
  onOpenConnectModal?: () => void;
}

export function GitHubContributionGraph({
  calendar,
  githubUsername,
  onRefresh,
  isSyncing = false,
  onOpenConnectModal,
}: GitHubContributionGraphProps) {
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const cleanUser = cleanHandle(githubUsername);
  const days = calendar?.days || [];
  const totalContributions = calendar?.totalContributions ?? 0;

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
          <div className="flex items-center gap-2">
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

      {/* Main Contribution Graph Container */}
      {cleanUser && days.length > 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-[#0d1117] p-4 sm:p-5 overflow-x-auto relative shadow-inner">
          {/* Tooltip */}
          {hoveredDay && (
            <div
              className="pointer-events-none fixed z-50 px-2.5 py-1.5 rounded-md bg-zinc-900 text-white text-[11px] font-mono border border-zinc-700 shadow-xl whitespace-nowrap -translate-x-1/2 -translate-y-full -mt-2 transition-all"
              style={{ left: hoveredDay.x, top: hoveredDay.y }}
            >
              <div className="font-semibold text-emerald-400">
                {hoveredDay.count === 0 ? 'No contributions' : `${hoveredDay.count} contribution${hoveredDay.count > 1 ? 's' : ''}`}
              </div>
              <div className="text-[10px] text-zinc-400">{formatDayTooltip(hoveredDay.date)}</div>
            </div>
          )}

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
                    {week.map((day) => (
                      <div
                        key={day.date}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredDay({
                            date: day.date,
                            count: day.count,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onMouseLeave={() => setHoveredDay(null)}
                        className={`w-[11px] h-[11px] sm:w-[12px] sm:h-[12px] rounded-[2px] transition-transform duration-100 hover:scale-125 cursor-pointer ${getCellColor(
                          day.level
                        )}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Footer: Learn link & Legend */}
            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-4 mt-2 border-t border-zinc-800/60">
              <a
                href="https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/why-are-my-contributions-not-showing-up-on-my-profile"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-zinc-300 transition-colors text-[11px]"
              >
                Learn how we count contributions
              </a>

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
    </div>
  );
}
