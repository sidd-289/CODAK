'use client';

import React, { useState, useEffect } from 'react';
import { GitHubCommitItem } from '@/types/codingProfiles';
import { GitCommit, GitBranch, ExternalLink, Search, RefreshCw, FolderGit2, CheckCircle2 } from 'lucide-react';

interface GitHubCommitsTableProps {
  commits: GitHubCommitItem[];
  githubUsername: string | null;
  onRefresh?: () => Promise<void>;
  isSyncing?: boolean;
  onOpenConnectModal?: () => void;
}

export function GitHubCommitsTable({
  commits,
  githubUsername,
  onRefresh,
  isSyncing = false,
  onOpenConnectModal,
}: GitHubCommitsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRepo, setFilterRepo] = useState<string>('all');
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const filteredCommits = commits.filter((c) => {
    const matchesSearch =
      c.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.repoName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.shortSha.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRepo = filterRepo === 'all' || c.repoName === filterRepo;
    return matchesSearch && matchesRepo;
  });

  const uniqueRepos = Array.from(new Set(commits.map((c) => c.repoName)));

  function formatRelativeTime(isoString: string): string {
    try {
      const date = new Date(isoString);
      if (!now) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      const diffMs = Math.max(0, now - date.getTime());
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  }

  function renderMessageWithBadges(message: string) {
    const match = message.match(/^([a-z]+)(\([a-z0-9_-]+\))?:\s*(.+)$/i);
    if (!match) {
      return <span className="text-zinc-200 font-mono text-xs">{message}</span>;
    }

    const type = match[1].toLowerCase();
    const scope = match[2];
    const rest = match[3];

    let badgeColor = 'bg-zinc-800 text-zinc-300 border-zinc-700';
    if (type === 'feat') badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (type === 'fix') badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    if (type === 'chore' || type === 'refactor') badgeColor = 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    if (type === 'perf') badgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/30';

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${badgeColor}`}>
          {type}{scope || ''}
        </span>
        <span className="text-zinc-200 font-mono text-xs truncate max-w-md">{rest}</span>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl bg-zinc-950/70 border border-zinc-800/80 p-5 md:p-6 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center text-white shadow-inner">
            <GitCommit className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-wide">
                Verified GitHub Commits
              </h3>
              {githubUsername && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                  @{githubUsername}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              Live telemetry tracking public commits and open-source contributions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:text-white hover:border-zinc-500 transition-all disabled:opacity-50"
              title="Sync latest GitHub commits"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Commits'}</span>
            </button>
          )}

          {githubUsername ? (
            <a
              href={`https://github.com/${githubUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs text-sky-300 hover:bg-sky-500/20 transition-all font-medium"
            >
              <span>GitHub Profile</span>
              <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
            </a>
          ) : (
            <button
              onClick={onOpenConnectModal}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-900/30 transition-all"
            >
              Connect GitHub
            </button>
          )}
        </div>
      </div>

      {/* Filter / Search Bar */}
      {commits.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 pb-4">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search commit messages or repos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-sky-500/50"
            />
          </div>

          {uniqueRepos.length > 1 && (
            <select
              value={filterRepo}
              onChange={(e) => setFilterRepo(e.target.value)}
              className="w-full sm:w-48 bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-sky-500/50"
            >
              <option value="all">All Repositories ({commits.length})</option>
              {uniqueRepos.map((repo) => (
                <option key={repo} value={repo}>
                  {repo}
                </option>
              ))}
            </select>
          )}

          <div className="sm:ml-auto text-xs text-zinc-500 font-mono">
            Showing {filteredCommits.length} of {commits.length} commits
          </div>
        </div>
      )}

      {/* Commits Table */}
      {filteredCommits.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-900/40">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-900/80 text-zinc-400 font-semibold tracking-wider uppercase text-[10px]">
                <th className="py-3 px-4">Repository</th>
                <th className="py-3 px-4">Commit Message</th>
                <th className="py-3 px-4">Commit SHA</th>
                <th className="py-3 px-4">Pushed</th>
                <th className="py-3 px-4 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {filteredCommits.map((commit) => (
                <tr
                  key={commit.id}
                  className="hover:bg-zinc-800/30 transition-colors group"
                >
                  {/* Repo */}
                  <td className="py-3 px-4 font-medium whitespace-nowrap">
                    <a
                      href={commit.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 hover:underline"
                    >
                      <FolderGit2 className="w-3.5 h-3.5 text-sky-500/80" />
                      <span>{commit.repoName}</span>
                    </a>
                  </td>

                  {/* Message */}
                  <td className="py-3 px-4 max-w-xs md:max-w-md">
                    {renderMessageWithBadges(commit.message)}
                  </td>

                  {/* Short SHA */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <a
                      href={commit.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700/60 transition-all"
                    >
                      <GitBranch className="w-3 h-3 text-zinc-500" />
                      <span>{commit.shortSha}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                    </a>
                  </td>

                  {/* Time */}
                  <td className="py-3 px-4 text-zinc-400 whitespace-nowrap" title={commit.committedAt}>
                    {formatRelativeTime(commit.committedAt)}
                  </td>

                  {/* Verification Badge */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Verified</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Empty State */
        <div className="py-12 flex flex-col items-center justify-center text-center px-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
            <FolderGit2 className="w-6 h-6 text-zinc-400" />
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">
            {githubUsername ? 'No Public Commits Found' : 'No GitHub Account Connected'}
          </h4>
          <p className="text-xs text-zinc-400 max-w-sm mb-4">
            {githubUsername
              ? 'We could not detect recent public push events for this account. Push code to your public GitHub repositories and click Sync.'
              : 'Link your GitHub username in the profile to automatically showcase your real-world coding commits, repositories, and activity.'}
          </p>
          <button
            onClick={onOpenConnectModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-sky-900/30 transition-all"
          >
            {githubUsername ? 'Edit GitHub Username' : 'Connect GitHub Account'}
          </button>
        </div>
      )}
    </div>
  );
}
