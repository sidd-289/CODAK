'use client';

import React, { useState } from 'react';
import { StudentCodingProfilesData } from '@/types/codingProfiles';
import {
  ExternalLink,
  Edit2,
  RefreshCw,
  Code2,
  Trophy,
  CheckCircle,
  X,
  AlertCircle,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ExternalCodingProfilesSectionProps {
  data: StudentCodingProfilesData;
  onSaveHandles: (handles: {
    leetcodeHandle?: string | null;
    githubUsername?: string | null;
    codeforcesHandle?: string | null;
    codechefHandle?: string | null;
  }) => Promise<{ success: boolean; error?: string }>;
  onSync: () => Promise<void>;
  isSyncing: boolean;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

export function ExternalCodingProfilesSection({
  data,
  onSaveHandles,
  onSync,
  isSyncing,
  isModalOpen,
  setIsModalOpen,
}: ExternalCodingProfilesSectionProps) {
  // Modal state
  const [leetcodeInput, setLeetcodeInput] = useState(data.leetcodeHandle || '');
  const [githubInput, setGithubInput] = useState(data.githubUsername || '');
  const [codeforcesInput, setCodeforcesInput] = useState(data.codeforcesHandle || '');
  const [codechefInput, setCodechefInput] = useState(data.codechefHandle || '');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync state into inputs when modal opens
  const openEditModal = () => {
    setLeetcodeInput(data.leetcodeHandle || '');
    setGithubInput(data.githubUsername || '');
    setCodeforcesInput(data.codeforcesHandle || '');
    setCodechefInput(data.codechefHandle || '');
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  };


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await onSaveHandles({
      leetcodeHandle: leetcodeInput,
      githubUsername: githubInput,
      codeforcesHandle: codeforcesInput,
      codechefHandle: codechefInput,
    });

    setSaving(false);
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to update coding profiles.');
    } else {
      setSuccessMessage('Coding profiles updated and synced successfully!');
      setTimeout(() => {
        setIsModalOpen(false);
      }, 1200);
    }
  };

  const formatLastSync = (isoString: string | null) => {
    if (!isoString) return 'Not synced yet';
    try {
      const d = new Date(isoString);
      return `Synced ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="relative rounded-2xl bg-zinc-950/70 border border-zinc-800/80 p-5 md:p-6 backdrop-blur-xl shadow-2xl overflow-hidden mb-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/60">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-sky-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Code2 className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-wide">
              External Coding Profiles
            </h3>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Verified Ecosystem
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Aggregate your competitive programming standings across LeetCode, GitHub, Codeforces, and CodeChef.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500 font-mono hidden md:inline-block">
            {formatLastSync(data.lastSyncedAt)}
          </span>

          <button
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:text-white hover:border-zinc-500 transition-all disabled:opacity-50"
            title="Refresh and sync all stats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Stats'}</span>
          </button>

          <button
            onClick={openEditModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-sky-900/30 transition-all"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Link Handles</span>
          </button>
        </div>
      </div>

      {/* 4 Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* 1. LeetCode Card */}
        <div className="rounded-xl bg-gradient-to-b from-zinc-900/80 to-zinc-950 border border-zinc-800 p-4 hover:border-amber-500/40 transition-all group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-400 text-xs">
                  LC
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200">LeetCode</h4>
                  <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[100px]">
                    {data.leetcodeHandle ? `@${data.leetcodeHandle}` : 'Not linked'}
                  </p>
                </div>
              </div>
              {data.leetcodeHandle && (
                <a
                  href={`https://leetcode.com/u/${data.leetcodeHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-amber-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {data.leetcodeStats ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-white font-mono">
                    {data.leetcodeStats.totalSolved}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Rank #{data.leetcodeStats.ranking ? data.leetcodeStats.ranking.toLocaleString() : 'N/A'}
                  </span>
                </div>

                {/* Difficulty bars */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-emerald-400">Easy</span>
                    <span className="font-mono text-zinc-300">{data.leetcodeStats.easySolved}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-amber-400">Medium</span>
                    <span className="font-mono text-zinc-300">{data.leetcodeStats.mediumSolved}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-rose-400">Hard</span>
                    <span className="font-mono text-zinc-300">{data.leetcodeStats.hardSolved}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-xs text-zinc-500">No LeetCode handle linked</p>
                <button
                  onClick={openEditModal}
                  className="mt-2 text-[11px] text-amber-400 hover:underline"
                >
                  + Add handle
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. GitHub Card */}
        <div className="rounded-xl bg-gradient-to-b from-zinc-900/80 to-zinc-950 border border-zinc-800 p-4 hover:border-sky-500/40 transition-all group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center font-bold text-sky-400 text-xs">
                  GH
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200">GitHub</h4>
                  <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[100px]">
                    {data.githubUsername ? `@${data.githubUsername}` : 'Not linked'}
                  </p>
                </div>
              </div>
              {data.githubUsername && (
                <a
                  href={`https://github.com/${data.githubUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-sky-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {data.githubStats ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-white font-mono">
                    {data.githubStats.publicRepos}
                  </span>
                  <span className="text-[10px] text-zinc-400">Public Repos</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/60">
                  <div className="bg-zinc-950/60 p-2 rounded border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Followers</span>
                    <span className="text-xs font-mono font-bold text-zinc-200">
                      {data.githubStats.followers}
                    </span>
                  </div>
                  <div className="bg-zinc-950/60 p-2 rounded border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Commits</span>
                    <span className="text-xs font-mono font-bold text-sky-400">
                      {data.recentGithubCommits.length}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-xs text-zinc-500">No GitHub handle linked</p>
                <button
                  onClick={openEditModal}
                  className="mt-2 text-[11px] text-sky-400 hover:underline"
                >
                  + Add username
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3. Codeforces Card */}
        <div className="rounded-xl bg-gradient-to-b from-zinc-900/80 to-zinc-950 border border-zinc-800 p-4 hover:border-indigo-500/40 transition-all group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 text-xs">
                  CF
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200">Codeforces</h4>
                  <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[100px]">
                    {data.codeforcesHandle ? `@${data.codeforcesHandle}` : 'Not linked'}
                  </p>
                </div>
              </div>
              {data.codeforcesHandle && (
                <a
                  href={`https://codeforces.com/profile/${data.codeforcesHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-indigo-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {data.codeforcesStats ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-white font-mono">
                    {data.codeforcesStats.rating}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-medium capitalize">
                    {data.codeforcesStats.rank}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/60">
                  <div className="bg-zinc-950/60 p-2 rounded border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Peak Rating</span>
                    <span className="text-xs font-mono font-bold text-zinc-200">
                      {data.codeforcesStats.maxRating}
                    </span>
                  </div>
                  <div className="bg-zinc-950/60 p-2 rounded border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Contribution</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      +{data.codeforcesStats.contribution}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-xs text-zinc-500">No Codeforces handle</p>
                <button
                  onClick={openEditModal}
                  className="mt-2 text-[11px] text-indigo-400 hover:underline"
                >
                  + Add handle
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 4. CodeChef Card */}
        <div className="rounded-xl bg-gradient-to-b from-zinc-900/80 to-zinc-950 border border-zinc-800 p-4 hover:border-amber-600/40 transition-all group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-600/10 border border-amber-600/20 flex items-center justify-center font-bold text-amber-500 text-xs">
                  CC
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200">CodeChef</h4>
                  <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[100px]">
                    {data.codechefHandle ? `@${data.codechefHandle}` : 'Not linked'}
                  </p>
                </div>
              </div>
              {data.codechefHandle && (
                <a
                  href={`https://www.codechef.com/users/${data.codechefHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-amber-500 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {data.codechefStats ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-white font-mono">
                    {data.codechefStats.rating}
                  </span>
                  <span className="text-[11px] font-bold text-amber-400 tracking-wider">
                    {data.codechefStats.stars}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/60">
                  <div className="bg-zinc-950/60 p-2 rounded border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Division</span>
                    <span className="text-xs font-mono font-bold text-zinc-200">
                      {data.codechefStats.division || 'Div 2'}
                    </span>
                  </div>
                  <div className="bg-zinc-950/60 p-2 rounded border border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 block">Peak Rating</span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {data.codechefStats.highestRating}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-xs text-zinc-500">No CodeChef handle</p>
                <button
                  onClick={openEditModal}
                  className="mt-2 text-[11px] text-amber-500 hover:underline"
                >
                  + Add handle
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Handles Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-sky-400" />
              <h3 className="text-base font-bold text-white">
                Link External Coding Profiles
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mb-5">
              Enter your official public usernames on LeetCode, GitHub, Codeforces, and CodeChef to aggregate ratings and sync commits into your student profile.
            </p>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* LeetCode */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  LeetCode Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">
                    leetcode.com/u/
                  </span>
                  <input
                    type="text"
                    value={leetcodeInput}
                    onChange={(e) => setLeetcodeInput(e.target.value)}
                    placeholder="your_leetcode_handle"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-32 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              {/* GitHub */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  GitHub Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">
                    github.com/
                  </span>
                  <input
                    type="text"
                    value={githubInput}
                    onChange={(e) => setGithubInput(e.target.value)}
                    placeholder="your_github_username"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-28 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>

              {/* Codeforces */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Codeforces Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">
                    codeforces.com/profile/
                  </span>
                  <input
                    type="text"
                    value={codeforcesInput}
                    onChange={(e) => setCodeforcesInput(e.target.value)}
                    placeholder="your_codeforces_handle"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-44 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              {/* CodeChef */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  CodeChef Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">
                    codechef.com/users/
                  </span>
                  <input
                    type="text"
                    value={codechefInput}
                    onChange={(e) => setCodechefInput(e.target.value)}
                    placeholder="your_codechef_handle"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-36 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-600/50"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-sky-900/40 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>{saving ? 'Saving & Syncing...' : 'Save & Sync Profiles'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
