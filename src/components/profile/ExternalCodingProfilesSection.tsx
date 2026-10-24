'use client';

import React, { useState } from 'react';
import { StudentCodingProfilesData } from '@/types/codingProfiles';
import {
  ExternalLink,
  Edit2,
  RefreshCw,
  Code2,
  CheckCircle,
  X,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { cleanHandle } from '@/lib/external-profiles/fetchers';
import { createClient } from '@/lib/supabase/client';

interface ExternalCodingProfilesSectionProps {
  data: StudentCodingProfilesData;
  onSaveHandles: (handles: {
    leetcodeHandle?: string | null;
    githubUsername?: string | null;
    codeforcesHandle?: string | null;
    codechefHandle?: string | null;
  }) => Promise<{ success: boolean; error?: string }>;
  onSync: () => Promise<void>;
  onVerifyAccount?: (platform: 'github' | 'leetcode' | 'codeforces' | 'codechef') => Promise<{ success: boolean; error?: string }>;
  isSyncing: boolean;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

export function ExternalCodingProfilesSection({
  data,
  onSaveHandles,
  onSync,
  onVerifyAccount,
  isSyncing,
  isModalOpen,
  setIsModalOpen,
}: ExternalCodingProfilesSectionProps) {
  const supabase = createClient();

  // Modal state
  const [leetcodeInput, setLeetcodeInput] = useState(data.leetcodeHandle || '');
  const [githubInput, setGithubInput] = useState(data.githubUsername || '');
  const [codeforcesInput, setCodeforcesInput] = useState(data.codeforcesHandle || '');
  const [codechefInput, setCodechefInput] = useState(data.codechefHandle || '');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Verification modal state
  const [verifyModalPlatform, setVerifyModalPlatform] = useState<'github' | 'leetcode' | 'codeforces' | 'codechef' | null>(null);
  const [githubTab, setGithubTab] = useState<'oauth' | 'bio'>('oauth');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRedirectingOAuth, setIsRedirectingOAuth] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const verificationToken = data.verificationToken || 'CODAK-AUTH-STUDENT';

  // Sync state into inputs when modal opens
  const openEditModal = () => {
    setLeetcodeInput(cleanHandle(data.leetcodeHandle) || '');
    setGithubInput(cleanHandle(data.githubUsername) || '');
    setCodeforcesInput(cleanHandle(data.codeforcesHandle) || '');
    setCodechefInput(cleanHandle(data.codechefHandle) || '');
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  };

  const openVerifyModal = (platform: 'github' | 'leetcode' | 'codeforces' | 'codechef') => {
    setVerifyModalPlatform(platform);
    setGithubTab('oauth');
    setVerifyError(null);
    setVerifySuccess(null);
    setCopiedToken(false);
    setIsRedirectingOAuth(false);
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(verificationToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // 1-Click GitHub OAuth Redirect
  const handleGitHubOAuthRedirect = async () => {
    setIsRedirectingOAuth(true);
    setVerifyError(null);
    try {
      const origin = window.location.origin;
      const { data: linkData, error: linkErr } = await supabase.auth.linkIdentity({
        provider: 'github',
        options: {
          redirectTo: `${origin}/auth/callback?next=/student/profile?github_verified=1`,
        },
      });

      if (!linkErr && linkData?.url) {
        window.location.href = linkData.url;
        return;
      }

      // If linking fails, show exact error and provide Bio Challenge fallback
      setGithubTab('bio');
      setVerifyError(
        linkErr?.message || 'OAuth linking failed. You can verify your account instantly using the Bio Challenge below.'
      );
      setIsRedirectingOAuth(false);
    } catch (err: any) {
      setGithubTab('bio');
      setVerifyError(err.message || 'OAuth redirect unavailable. Use the Bio Challenge below.');
      setIsRedirectingOAuth(false);
    }
  };

  const handleExecuteVerification = async () => {
    if (!verifyModalPlatform || !onVerifyAccount) return;
    setIsVerifying(true);
    setVerifyError(null);
    setVerifySuccess(null);

    const res = await onVerifyAccount(verifyModalPlatform);
    setIsVerifying(false);
    if (!res.success) {
      setVerifyError(res.error || 'Verification code not found. Make sure you saved your profile bio and try again.');
    } else {
      setVerifySuccess('Account successfully verified! Genuine ownership confirmed.');
      setTimeout(() => {
        setVerifyModalPlatform(null);
      }, 1500);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await onSaveHandles({
      leetcodeHandle: cleanHandle(leetcodeInput),
      githubUsername: cleanHandle(githubInput),
      codeforcesHandle: cleanHandle(codeforcesInput),
      codechefHandle: cleanHandle(codechefInput),
    });

    setSaving(false);
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to update coding profiles.');
    } else {
      setSuccessMessage('Coding profiles updated and live stats synced!');
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

  const getPlatformProfileUrl = (platform: 'github' | 'leetcode' | 'codeforces' | 'codechef') => {
    switch (platform) {
      case 'github':
        return `https://github.com/settings/profile`;
      case 'leetcode':
        return `https://leetcode.com/profile/`;
      case 'codeforces':
        return `https://codeforces.com/settings/social`;
      case 'codechef':
        return `https://www.codechef.com/users/${data.codechefHandle}`;
    }
  };

  return (
    <div className="relative rounded-2xl bg-zinc-950/70 border border-zinc-800/80 p-5 md:p-6 backdrop-blur-xl shadow-2xl overflow-hidden mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/60">
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
              <div className="flex items-center gap-1.5">
                {data.leetcodeHandle && (
                  data.leetcodeVerified ? (
                    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold" title="Verified Account Owner">
                      <ShieldCheck className="w-2.5 h-2.5" /> Verified
                    </span>
                  ) : (
                    <button
                      onClick={() => openVerifyModal('leetcode')}
                      className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 font-medium transition-all"
                      title="Click to verify account ownership"
                    >
                      <ShieldAlert className="w-2.5 h-2.5" /> Verify
                    </button>
                  )
                )}
                {data.leetcodeHandle && (
                  <a
                    href={`https://leetcode.com/u/${data.leetcodeHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-amber-400 transition-colors ml-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
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
                    {data.githubUsername ? `@${cleanHandle(data.githubUsername)}` : 'Not linked'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {data.githubUsername ? (
                  data.githubVerified ? (
                    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold" title="Verified Account Owner">
                      <ShieldCheck className="w-2.5 h-2.5" /> Verified
                    </span>
                  ) : (
                    <button
                      onClick={() => openVerifyModal('github')}
                      className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30 font-medium transition-all"
                      title="Click to verify account ownership"
                    >
                      <ShieldAlert className="w-2.5 h-2.5" /> Verify
                    </button>
                  )
                ) : (
                  <button
                    onClick={openEditModal}
                    className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 font-medium transition-all"
                    title="Link GitHub Handle"
                  >
                    <span>+ Link</span>
                  </button>
                )}
                {data.githubUsername && (
                  <a
                    href={`https://github.com/${cleanHandle(data.githubUsername)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-sky-400 transition-colors ml-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
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
                <div className="flex items-center justify-center gap-2 mt-2">
                  <button
                    onClick={() => openVerifyModal('github')}
                    className="text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Connect GitHub</span>
                  </button>
                  <span className="text-zinc-600 text-xs">•</span>
                  <button
                    onClick={openEditModal}
                    className="text-[11px] text-sky-400 hover:underline"
                  >
                    Add username
                  </button>
                </div>
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
              <div className="flex items-center gap-1.5">
                {data.codeforcesHandle && (
                  data.codeforcesVerified ? (
                    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold" title="Verified Account Owner">
                      <ShieldCheck className="w-2.5 h-2.5" /> Verified
                    </span>
                  ) : (
                    <button
                      onClick={() => openVerifyModal('codeforces')}
                      className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 font-medium transition-all"
                      title="Click to verify account ownership"
                    >
                      <ShieldAlert className="w-2.5 h-2.5" /> Verify
                    </button>
                  )
                )}
                {data.codeforcesHandle && (
                  <a
                    href={`https://codeforces.com/profile/${data.codeforcesHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-indigo-400 transition-colors ml-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
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
              <div className="flex items-center gap-1.5">
                {data.codechefHandle && (
                  data.codechefVerified ? (
                    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold" title="Verified Account Owner">
                      <ShieldCheck className="w-2.5 h-2.5" /> Verified
                    </span>
                  ) : (
                    <button
                      onClick={() => openVerifyModal('codechef')}
                      className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 font-medium transition-all"
                      title="Click to verify account ownership"
                    >
                      <ShieldAlert className="w-2.5 h-2.5" /> Verify
                    </button>
                  )
                )}
                {data.codechefHandle && (
                  <a
                    href={`https://www.codechef.com/users/${data.codechefHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-amber-500 transition-colors ml-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg max-h-[88vh] rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-white">Link Coding Profiles</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Enter your username or profile URL on LeetCode, GitHub, Codeforces, and CodeChef.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <form id="link-handles-form" onSubmit={handleSave} className="space-y-4">
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
                      onChange={(e) => setLeetcodeInput(cleanHandle(e.target.value) || e.target.value)}
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
                      onChange={(e) => setGithubInput(cleanHandle(e.target.value) || e.target.value)}
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
                      onChange={(e) => setCodeforcesInput(cleanHandle(e.target.value) || e.target.value)}
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
                      onChange={(e) => setCodechefInput(cleanHandle(e.target.value) || e.target.value)}
                      placeholder="your_codechef_handle"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-36 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-600/50"
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* Sticky Actions Footer */}
            <div className="p-4 bg-zinc-950/90 border-t border-zinc-800 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="link-handles-form"
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-sky-900/40 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>{saving ? 'Saving & Syncing...' : 'Save & Sync Profiles'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Ownership Verification Modal */}
      {verifyModalPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md max-h-[88vh] rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Verify {verifyModalPlatform === 'github' ? 'GitHub' : verifyModalPlatform === 'leetcode' ? 'LeetCode' : verifyModalPlatform === 'codeforces' ? 'Codeforces' : 'CodeChef'} Ownership
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {verifyModalPlatform === 'github' && data.githubUsername ? (
                      <>Account: <span className="text-white font-mono font-semibold">@{cleanHandle(data.githubUsername)}</span></>
                    ) : verifyModalPlatform === 'leetcode' && data.leetcodeHandle ? (
                      <>Account: <span className="text-white font-mono font-semibold">@{cleanHandle(data.leetcodeHandle)}</span></>
                    ) : verifyModalPlatform === 'codeforces' && data.codeforcesHandle ? (
                      <>Account: <span className="text-white font-mono font-semibold">@{cleanHandle(data.codeforcesHandle)}</span></>
                    ) : verifyModalPlatform === 'codechef' && data.codechefHandle ? (
                      <>Account: <span className="text-white font-mono font-semibold">@{cleanHandle(data.codechefHandle)}</span></>
                    ) : (
                      'Confirm authentic ownership of your profile'
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVerifyModalPlatform(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* GitHub Tab Switcher */}
              {verifyModalPlatform === 'github' && (
                <div className="flex rounded-lg bg-zinc-900 p-1 border border-zinc-800 text-xs">
                  <button
                    onClick={() => {
                      setGithubTab('oauth');
                      setVerifyError(null);
                    }}
                    className={`flex-1 py-1.5 rounded-md font-semibold text-center transition-all ${
                      githubTab === 'oauth'
                        ? 'bg-zinc-800 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    1-Click OAuth
                  </button>
                  <button
                    onClick={() => {
                      setGithubTab('bio');
                      setVerifyError(null);
                    }}
                    className={`flex-1 py-1.5 rounded-md font-semibold text-center transition-all ${
                      githubTab === 'bio'
                        ? 'bg-zinc-800 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Bio Challenge Code
                  </button>
                </div>
              )}

              {/* GitHub OAuth Tab Content */}
              {verifyModalPlatform === 'github' && githubTab === 'oauth' && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-black border border-zinc-800 shadow-lg space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Instant Verification
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Authorize CODAK directly with your GitHub account. No copying codes or editing bios required.
                  </p>
                  <button
                    onClick={handleGitHubOAuthRedirect}
                    disabled={isRedirectingOAuth}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                    <span>{isRedirectingOAuth ? 'Redirecting to GitHub...' : 'Log in & Link GitHub'}</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
                  </button>
                  <p className="text-[10px] text-zinc-500 text-center leading-normal">
                    If manual linking is disabled in Supabase, switch to the <strong>Bio Challenge Code</strong> tab to verify instantly.
                  </p>
                </div>
              )}

              {/* Bio Challenge Content */}
              {(verifyModalPlatform !== 'github' || githubTab === 'bio') && (
                <div className="space-y-3">
                  {verifyModalPlatform !== 'github' && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed">
                      <strong>Note:</strong> {verifyModalPlatform === 'leetcode' ? 'LeetCode' : verifyModalPlatform === 'codeforces' ? 'Codeforces' : 'CodeChef'} does not provide third-party OAuth logins. Use the quick Bio Challenge below.
                    </div>
                  )}

                  <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs space-y-2.5">
                    <p className="text-zinc-300 leading-relaxed">
                      Add this unique challenge code to your public{' '}
                      <strong className="text-white capitalize">{verifyModalPlatform}</strong>{' '}
                      {verifyModalPlatform === 'github' ? 'Bio or create a public Gist' : verifyModalPlatform === 'leetcode' ? 'About Me / Summary' : verifyModalPlatform === 'codeforces' ? 'Organization or City' : 'Bio'}:
                    </p>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-black border border-zinc-800">
                      <code className="text-xs font-mono font-bold text-emerald-400 tracking-wider">
                        {verificationToken}
                      </code>
                      <button
                        onClick={handleCopyToken}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-white transition-all active:scale-95"
                      >
                        {copiedToken ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-zinc-400" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-[11px] text-zinc-500 flex items-center justify-between pt-1">
                      <span>1. Copy code</span>
                      <span>2. Paste into Bio</span>
                      <span>3. Click Verify below</span>
                    </div>
                  </div>
                </div>
              )}

              {verifyError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              {verifySuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{verifySuccess}</span>
                </div>
              )}
            </div>

            {/* Sticky Actions Footer */}
            <div className="p-4 bg-zinc-950/90 border-t border-zinc-800 flex items-center justify-between gap-3 shrink-0">
              <a
                href={getPlatformProfileUrl(verifyModalPlatform)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-sky-400 hover:underline"
              >
                <span>Edit Profile on {verifyModalPlatform}</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyModalPlatform(null)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium"
                >
                  Close
                </button>
                {(verifyModalPlatform !== 'github' || githubTab === 'bio') && (
                  <button
                    onClick={handleExecuteVerification}
                    disabled={isVerifying}
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isVerifying && <RefreshCw className="w-3 h-3 animate-spin" />}
                    <span>{isVerifying ? 'Checking...' : 'Check & Verify'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
