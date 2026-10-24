'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { createClient } from '@/lib/supabase/client';
import { levelFromXp, LevelProgress } from '@/lib/levels';
import { XpEvent } from '@/types/database';
import { ShieldCheck, EyeOff, Award, Sparkles, TrendingUp, History, Clock, LogOut, Edit3, X, CheckCircle2 } from 'lucide-react';
import Aurora from '@/components/Aurora';
import { BadgeTile } from '@/components/ui/game-elements';
import { getStudentBadgesAction, StudentBadgeDisplay } from '@/app/actions/badges';
import { updateAnonymousPreferenceAction } from '@/app/actions/leaderboard';
import { updateStudentProfileAction } from '@/app/actions/student-dashboard';
import { formatCampusDisplayName } from '@/lib/campus';
import { RankChip } from '@/components/ranks/RankChip';
import { RankProgressSection } from '@/components/ranks/RankProgressSection';
import { getMyRankProgressAction, getRankTiersAction } from '@/app/actions/ranks';
import { RankTier } from '@/types/database';
import { RankProgress } from '@/lib/ranks';
import { CelebrationManager } from '@/components/animations/CelebrationManager';
import { ExternalCodingProfilesSection } from '@/components/profile/ExternalCodingProfilesSection';
import { GitHubContributionGraph } from '@/components/profile/GitHubContributionGraph';
import { GitHubCommitsTable } from '@/components/profile/GitHubCommitsTable';
import {
  getStudentCodingProfilesAction,
  saveStudentCodingHandlesAction,
  syncStudentCodingProfilesAction,
} from '@/app/actions/coding-profiles';
import { StudentCodingProfilesData } from '@/types/codingProfiles';

export default function StudentProfilePage() {
  const supabase = createClient();

  const [studentName, setStudentName] = useState('Student');
  const [rollNo, setRollNo] = useState('CS-2026-042');
  const [department, setDepartment] = useState('Computer Science');
  const [yearOfStudy, setYearOfStudy] = useState(1);
  const [campusName, setCampusName] = useState('Unassigned');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [totalXp, setTotalXp] = useState(0);
  const [levelInfo, setLevelInfo] = useState<LevelProgress>(levelFromXp(0));
  const [rankProgress, setRankProgress] = useState<RankProgress | null>(null);
  const [allTiers, setAllTiers] = useState<RankTier[]>([]);
  const [events, setEvents] = useState<XpEvent[]>([]);
  const [badges, setBadges] = useState<StudentBadgeDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Edit Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRollNo, setEditRollNo] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editYear, setEditYear] = useState(1);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccessMessage, setEditSuccessMessage] = useState<string | null>(null);

  // External Coding Profiles State
  const [codingProfiles, setCodingProfiles] = useState<StudentCodingProfilesData>({
    studentId: '',
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
  });
  const [isSyncingCoding, setIsSyncingCoding] = useState(false);
  const [isCodingModalOpen, setIsCodingModalOpen] = useState(false);

  useEffect(() => {
    async function fetchStudentData() {
      setLoading(true);

      // Hydrate avatar from local storage
      try {
        const saved = localStorage.getItem('academy_student_avatar');
        if (saved) setAvatarUrl(saved);
      } catch {
        // Local storage access blocked or unavailable
      }

      // 1. Get current logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let studentId = user?.id;

      if (user) {
        // Fetch profile with campus relation
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, campuses(*)')
          .eq('id', user.id)
          .single();

        if (profile) {
          setStudentName(profile.full_name);
          setIsAnonymous(profile.is_anonymous);
          setCampusName(formatCampusDisplayName(profile.campuses as any, profile.campus_other_name));
        }

        // Fetch student record
        const { data: studentRecord } = await supabase
          .from('students')
          .select('*')
          .eq('id', user.id)
          .single();

        if (studentRecord) {
          setRollNo(studentRecord.roll_no);
          setDepartment(studentRecord.department);
          setYearOfStudy(studentRecord.year_of_study);
        }
      }

      // If in demo mode or not logged in, fallback to demo student ID
      if (!studentId) {
        const { data: demoStudent } = await supabase
          .from('students')
          .select('id, roll_no, department, profiles(full_name, is_anonymous)')
          .limit(1)
          .single();

        if (demoStudent) {
          studentId = demoStudent.id;
          setRollNo(demoStudent.roll_no);
          setDepartment(demoStudent.department);
          setStudentName((demoStudent as any).profiles?.full_name || 'Student');
        }
      }

      if (studentId) {
        // Fetch ledger events (RLS isolates this strictly to student's own rows)
        const { data: eventsData } = await supabase
          .from('xp_events')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false });

        if (eventsData) {
          const rows = eventsData as XpEvent[];
          setEvents(rows);

          // Calculate total from valid ledger rows
          const sum = rows
            .filter((e) => e.status === 'valid')
            .reduce((acc, curr) => acc + curr.xp_amount, 0);

          setTotalXp(sum);
          setLevelInfo(levelFromXp(sum));
        }

        // Fetch student badges (earned and locked)
        try {
          const badgeRes = await getStudentBadgesAction(studentId);
          if (badgeRes.success) {
            setBadges(badgeRes.badges);
          }
        } catch (e) {
          console.error('Error fetching badges in profile:', e);
        }

        // Fetch rank progress and tiers
        try {
          const [rankRes, tiersRes] = await Promise.all([
            getMyRankProgressAction(studentId),
            getRankTiersAction(),
          ]);
          if (rankRes.success && rankRes.progress) {
            setRankProgress(rankRes.progress);
          }
          if (tiersRes.success && tiersRes.tiers) {
            setAllTiers(tiersRes.tiers);
          }
        } catch (e) {
          console.error('Error fetching rank progress in profile:', e);
        }

        // Fetch external coding profiles
        try {
          const codingRes = await getStudentCodingProfilesAction(studentId);
          if (codingRes.success && codingRes.profile) {
            setCodingProfiles(codingRes.profile);
          }
        } catch (e) {
          console.error('Error fetching coding profiles in profile:', e);
        }
      }

      setLoading(false);
    }

    fetchStudentData();
  }, []);

  const handleToggleAnonymous = async () => {
    const nextVal = !isAnonymous;
    setIsAnonymous(nextVal);
    try {
      await updateAnonymousPreferenceAction(nextVal);
    } catch (e) {
      console.error('Failed to update anonymous preference:', e);
      setIsAnonymous(!nextVal);
    }
  };

  const handleSaveCodingHandles = async (handles: {
    leetcodeHandle?: string | null;
    githubUsername?: string | null;
    codeforcesHandle?: string | null;
    codechefHandle?: string | null;
  }) => {
    try {
      const res = await saveStudentCodingHandlesAction({
        studentId: codingProfiles.studentId || undefined,
        ...handles,
      });
      if (res.success && res.profile) {
        setCodingProfiles(res.profile);
        return { success: true };
      }
      return { success: false, error: res.error || 'Failed to save profiles' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Save failed' };
    }
  };

  const handleSyncCodingProfiles = async () => {
    setIsSyncingCoding(true);
    try {
      const res = await syncStudentCodingProfilesAction(codingProfiles.studentId || undefined);
      if (res.success && res.profile) {
        setCodingProfiles(res.profile);
      }
    } catch (e) {
      console.error('Failed to sync coding profiles:', e);
    } finally {
      setIsSyncingCoding(false);
    }
  };

  const handleOpenEditModal = () => {
    setEditName(studentName);
    setEditRollNo(rollNo);
    setEditDepartment(department);
    setEditYear(yearOfStudy);
    setEditError(null);
    setEditSuccessMessage(null);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setEditError(null);
    setEditSuccessMessage(null);

    const res = await updateStudentProfileAction({
      fullName: editName,
      rollNo: editRollNo,
      department: editDepartment,
      yearOfStudy: editYear,
    });

    if (res.success) {
      setStudentName(editName.trim());
      setRollNo(editRollNo.trim());
      setDepartment(editDepartment.trim());
      setYearOfStudy(editYear);
      setEditSuccessMessage('Profile details updated successfully!');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccessMessage(null);
      }, 1000);
    } else {
      setEditError(res.error || 'Failed to update profile.');
    }
    setSavingProfile(false);
  };

  const formatActionName = (action: string) => {
    return action
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="min-h-screen flex flex-col relative pb-24 overflow-x-hidden bg-transparent">
      {/* Ambient WebGL Aurora Background for Profile Page */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-black/80">
        <Aurora
          colorStops={['#ffffff', '#27272a', '#09090b']}
          amplitude={1.1}
          blend={0.5}
          height={0.55}
          speed={0.9}
          glow={0.6}
          scale={1}
          brightness={1}
          layers={1}
          direction="top"
          mouseInteraction={true}
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col w-full">
        {/* Celebration Manager for Level-Up and Rank-Up */}
        <CelebrationManager />

        <Navbar role="student" userName={studentName} />

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
          {/* Wide & Clean Profile Overview Card */}
          <section
            aria-label="Student profile overview"
            className="p-6 sm:p-8 rounded-3xl bg-zinc-900/60 border border-zinc-800 shadow-2xl backdrop-blur-xl relative overflow-hidden"
          >
            <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 sm:gap-8">
              {/* Avatar & Student Details */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 text-center sm:text-left">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/80 p-1 shadow-2xl shadow-black/60 flex items-center justify-center text-4xl shrink-0 overflow-hidden">
                  <div className="w-full h-full rounded-2xl bg-zinc-900/90 flex items-center justify-center overflow-hidden">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt={`${studentName}'s avatar`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      '👨‍🎓'
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{studentName}</h1>
                    <RankChip rank={rankProgress?.currentRank} level={levelInfo.level} size="sm" showLevel />
                  </div>
                  <p className="text-xs font-mono text-zinc-400">
                    Roll No: <span className="text-white font-medium">{rollNo}</span> • Year {yearOfStudy} • {department}
                  </p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2 text-xs text-zinc-400">
                    <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-zinc-800 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Campus</span>
                      <span className="text-white font-medium truncate max-w-[220px]" title={campusName}>{campusName}</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-zinc-800 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Timezone</span>
                      <span className="text-zinc-300 font-medium">Asia/Kolkata</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="shrink-0 flex items-center gap-2.5 self-center md:self-start">
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all active:scale-[0.98] shadow-sm shadow-white/10"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
                <a
                  href="/api/auth/signout"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 text-xs font-semibold transition-all active:scale-[0.98] shadow-sm cursor-target"
                  data-cursor-label="Log out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </a>
              </div>
            </div>
          </section>

          {/* Rank Progression Section (Lifetime Rank Ladder & Max Rank Progress) */}
          <RankProgressSection progress={rankProgress} allTiers={allTiers} />

          {/* External Coding Profiles Section (LeetCode, GitHub, Codeforces, CodeChef) */}
          <ExternalCodingProfilesSection
            data={codingProfiles}
            onSaveHandles={handleSaveCodingHandles}
            onSync={handleSyncCodingProfiles}
            isSyncing={isSyncingCoding}
            isModalOpen={isCodingModalOpen}
            setIsModalOpen={setIsCodingModalOpen}
          />

          {/* Authentic GitHub Contribution Activity Heatmap Graph */}
          <GitHubContributionGraph
            calendar={codingProfiles.githubCalendar}
            githubUsername={codingProfiles.githubUsername}
            onRefresh={handleSyncCodingProfiles}
            isSyncing={isSyncingCoding}
            onOpenConnectModal={() => setIsCodingModalOpen(true)}
          />

          {/* GitHub Commits Telemetry Table */}
          <GitHubCommitsTable
            commits={codingProfiles.recentGithubCommits}
            githubUsername={codingProfiles.githubUsername}
            onRefresh={handleSyncCodingProfiles}
            isSyncing={isSyncingCoding}
            onOpenConnectModal={() => setIsCodingModalOpen(true)}
          />

          {/* Badges Showcase (Earned and Locked Badges Grouped by Rank & Milestones) */}
          <section
            aria-label="Student Badges"
            className="p-6 sm:p-8 rounded-3xl bg-zinc-900/80 border border-zinc-800 shadow-xl"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-white" />
                <h2 className="text-base font-bold text-white">Badges & Achievements</h2>
              </div>
              <span className="text-xs text-zinc-300 font-mono font-semibold px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700">
                {badges.filter((b) => b.isEarned).length} / {badges.length} Unlocked
              </span>
            </div>

            {badges.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3">Loading badge milestones...</p>
            ) : (
              <div className="space-y-8">
                {/* Group 1: Academic Rank Badges */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <span>Academic Rank Badges</span>
                    </h3>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {badges.filter((b) => b.category === 'RANK' && b.isEarned).length} / {badges.filter((b) => b.category === 'RANK').length} Unlocked
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {badges
                      .filter((b) => b.category === 'RANK')
                      .sort((a, b) => ((a.criteria as any)?.min_level || 0) - ((b.criteria as any)?.min_level || 0))
                      .map((badge) => (
                        <BadgeTile
                          key={badge.code}
                          code={badge.code}
                          name={badge.name}
                          description={badge.description}
                          category={badge.category}
                          isEarned={badge.isEarned}
                          earnedAt={badge.earnedAt}
                          howToEarn={badge.howToEarn}
                        />
                      ))}
                  </div>
                </div>

                {/* Group 2: Learning Milestones & Achievements */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <span>Learning Milestones & Quests</span>
                    </h3>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {badges.filter((b) => b.category !== 'RANK' && b.isEarned).length} / {badges.filter((b) => b.category !== 'RANK').length} Unlocked
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {badges
                      .filter((b) => b.category !== 'RANK')
                      .map((badge) => (
                        <BadgeTile
                          key={badge.code}
                          code={badge.code}
                          name={badge.name}
                          description={badge.description}
                          category={badge.category}
                          isEarned={badge.isEarned}
                          earnedAt={badge.earnedAt}
                          howToEarn={badge.howToEarn}
                        />
                      ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Personal XP History Ledger Feed */}
          <section
            aria-label="Personal XP History"
            className="p-6 sm:p-8 rounded-3xl bg-zinc-900/80 border border-zinc-800 shadow-xl"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-white" />
                <h2 className="text-base font-bold text-white">XP History Ledger</h2>
              </div>
              <span className="text-xs text-zinc-400 font-mono px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700">
                {events.length} {events.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {loading ? (
              <p className="text-xs text-zinc-500 py-4">Reading ledger events...</p>
            ) : events.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-800 rounded-2xl">
                <Clock className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-400 font-medium">No learning activities recorded yet.</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Complete daily quizzes or attend lectures to earn XP!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
                  const isValid = event.status === 'valid';
                  return (
                    <div
                      key={event.id}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                        isValid
                          ? 'bg-black/60 border-zinc-800 hover:border-zinc-700'
                          : 'bg-zinc-950/60 border-zinc-800 opacity-70'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-zinc-200">
                            {formatActionName(event.action_type)}
                          </span>
                          {!isValid && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                              Adjusted
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono truncate max-w-[280px]">
                          {event.reference_id}
                        </div>
                        {!isValid && (
                          <div className="text-xs text-zinc-400 font-medium mt-1">
                            XP adjusted by faculty: {event.void_reason || 'Administrative adjustment'}
                          </div>
                        )}
                        <div className="text-xs text-zinc-400 mt-1">
                          {new Date(event.created_at).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Kolkata',
                          })}
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-base font-black font-mono ${
                            isValid ? 'text-white' : 'text-zinc-500 line-through'
                          }`}
                        >
                          +{event.xp_amount} XP
                        </span>
                        {!isValid && (
                          <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                            Adjusted
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Privacy & Session Settings (2-Column Grid on Wide Screens) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Server-Enforced Anonymous Mode Toggle */}
            <section
              aria-label="Anonymous mode toggle"
              className="p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between gap-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white">
                    <EyeOff className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Anonymous Mode</h2>
                    <p className="text-xs text-zinc-400">Opt out of public leaderboard names</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleAnonymous}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${
                    isAnonymous ? 'bg-white' : 'bg-zinc-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full transition-transform ${
                      isAnonymous ? 'bg-black translate-x-6' : 'bg-zinc-400 translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/60 border border-zinc-800 text-xs text-zinc-400 leading-relaxed">
                <strong className="text-zinc-200 block mb-0.5">Server-Enforced Privacy:</strong>
                When enabled, your name is replaced by a fun avatar on the server before reaching any API responses. Faculty and admins can always see your real identity.
              </div>
            </section>

            {/* Account Session & Log out */}
            <section
              aria-label="Account session actions"
              className="p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between gap-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">Active Session</h2>
                  <p className="text-xs text-zinc-400">Signed in as {studentName}</p>
                </div>

                <a
                  href="/api/auth/signout"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 transition-all active:scale-95 cursor-target"
                  data-cursor-label="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </a>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/60 border border-zinc-800 text-xs text-zinc-400 leading-relaxed font-mono">
                Security status: Authenticated • Session active on this device.
              </div>
            </section>
          </div>

          {/* Edit Profile Modal */}
          {isEditModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-3xl bg-[#0c0c0e] border border-white/20 p-6 sm:p-7 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Edit Student Profile</h3>
                </div>
                <p className="text-xs text-zinc-400 mb-5">
                  Update your official full name, roll number, and academic department details.
                </p>

                {editError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
                    {editError}
                  </div>
                )}

                {editSuccessMessage && (
                  <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{editSuccessMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g. Siddhant Gautam"
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-white/15 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      Roll Number <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editRollNo}
                      onChange={(e) => setEditRollNo(e.target.value)}
                      placeholder="e.g. 23BCSE101"
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-white/15 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-all font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300">
                        Department <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editDepartment}
                        onChange={(e) => setEditDepartment(e.target.value)}
                        placeholder="e.g. Computer Science"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/15 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300">
                        Year of Study
                      </label>
                      <select
                        value={editYear}
                        onChange={(e) => setEditYear(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/15 text-xs text-white focus:outline-none focus:border-white"
                      >
                        <option value={1}>Year 1</option>
                        <option value={2}>Year 2</option>
                        <option value={3}>Year 3</option>
                        <option value={4}>Year 4</option>
                        <option value={5}>Year 5</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10 mt-5">
                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={() => setIsEditModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition-all border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all disabled:opacity-50 shadow-md shadow-white/10"
                    >
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
