'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import {
  startBossBattleAction,
  submitBossBattleAnswerAction,
  finalizeBossBattleAction,
  ClientBossQuestion,
  BossBattleSessionState,
} from '@/app/actions/boss-battle';
import { CLIENT_BOSS_QUESTIONS } from '@/data/bossBattleQuestions';
import {
  Swords,
  Shield,
  Timer,
  Heart,
  Trophy,
  Sparkles,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Skull,
  Zap,
} from 'lucide-react';

export default function BossBattlePage() {
  const [session, setSession] = useState<BossBattleSessionState | null>({
    id: 'active-session',
    bossName: 'The Semester Gorgon (Final Boss)',
    bossMaxHp: 100,
    bossCurrentHp: 100,
    totalQuestions: CLIENT_BOSS_QUESTIONS.length,
    correctAnswers: 0,
    wrongAnswers: 0,
    timeLimitSeconds: 1200,
    timeSpentSeconds: 0,
    status: 'in_progress',
    scorePercentage: 0,
    xpAwarded: 0,
    startedAt: '',
  });
  const [questions, setQuestions] = useState<ClientBossQuestion[]>(CLIENT_BOSS_QUESTIONS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    explanation: string;
    damage: number;
  } | null>(null);

  // Boss Animation States
  const [bossHp, setBossHp] = useState(100);
  const [bossShake, setBossShake] = useState(false);
  const [slashEffect, setSlashEffect] = useState(false);

  // Timer State (20 minutes = 1200 seconds)
  const [secondsRemaining, setSecondsRemaining] = useState(1200);
  const [timeSpent, setTimeSpent] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Concluded State
  const [concluded, setConcluded] = useState(false);
  const [finalResult, setFinalResult] = useState<{
    won: boolean;
    scorePercentage: number;
    xpAwarded: number;
    badgeUnlocked?: string;
  } | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  // 1. Background sync with database
  useEffect(() => {
    async function syncBattle() {
      try {
        const res = await startBossBattleAction();
        if (res.success && res.session) {
          setSession(res.session);
          if (res.questions && res.questions.length > 0) {
            setQuestions(res.questions);
          }
          if (res.session.bossCurrentHp !== undefined) {
            setBossHp(res.session.bossCurrentHp);
          }
          const elapsed = Math.max(0, Math.floor((Date.now() - new Date(res.session.startedAt).getTime()) / 1000));
          const rem = Math.max(0, 1200 - elapsed);
          setSecondsRemaining(rem);
          setTimeSpent(elapsed);
        }
      } catch (err) {
        console.warn('Background boss battle sync warning:', err);
      }
    }
    syncBattle();
  }, []);

  const handleTimeExpired = useCallback(async () => {
    if (!session || concluded) return;
    setFinalizing(true);
    const res = await finalizeBossBattleAction(session.id);
    if (res.success) {
      setFinalResult({
        won: res.won,
        scorePercentage: res.scorePercentage,
        xpAwarded: res.xpAwarded,
        badgeUnlocked: res.badgeUnlocked,
      });
      setConcluded(true);
    }
    setFinalizing(false);
  }, [session, concluded]);

  // 2. Countdown Timer
  useEffect(() => {
    if (loading || concluded || !session) return;

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
      setTimeSpent((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, concluded, session]);

  // Handle time expiry
  useEffect(() => {
    if (secondsRemaining === 0 && session && !concluded && !loading) {
      handleTimeExpired();
    }
  }, [secondsRemaining, session, concluded, loading, handleTimeExpired]);

  const handleSelectOption = async (optionIndex: number) => {
    if (submittingAnswer || feedback || !session || concluded) return;

    setSubmittingAnswer(true);
    const currentQ = questions[currentIndex];

    try {
      const res = await submitBossBattleAnswerAction({
        sessionId: session.id,
        questionId: currentQ.id,
        selectedOptionIndex: optionIndex,
        timeSpentSeconds: timeSpent,
      });

      if (res.success) {
        const isCorrect = !!res.isCorrect;
        setFeedback({
          isCorrect,
          explanation: res.explanation || '',
          damage: isCorrect ? 7 : 0,
        });

        if (isCorrect) {
          setBossShake(true);
          setSlashEffect(true);
          setTimeout(() => {
            setBossShake(false);
            setSlashEffect(false);
          }, 600);
        }

        if (res.bossHp !== undefined) {
          setBossHp(res.bossHp);
        }

        // If boss is slain or last question answered, trigger finalize
        if (res.bossHp === 0 || currentIndex === questions.length - 1) {
          setTimeout(async () => {
            setFinalizing(true);
            const fin = await finalizeBossBattleAction(session.id);
            if (fin.success) {
              setFinalResult({
                won: fin.won,
                scorePercentage: fin.scorePercentage,
                xpAwarded: fin.xpAwarded,
                badgeUnlocked: fin.badgeUnlocked,
              });
              setConcluded(true);
            }
            setFinalizing(false);
          }, 1500);
        }
      }
    } catch (err) {
      console.error('Answer submission error:', err);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleNextQuestion = () => {
    setFeedback(null);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIndex];
  const hpPercent = Math.max(0, Math.min(100, bossHp));

  return (
    <div className="min-h-screen bg-black text-zinc-100 pb-24">
      <Navbar role="student" />

      <main className="max-w-4xl mx-auto px-4 pt-6">
        {/* Top Control Bar: Back Link & 20-min Countdown Clock */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/student/play"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <span>← Back to Play Hub</span>
          </Link>

          <div
            className={`px-4 py-2 rounded-2xl border flex items-center gap-2.5 font-mono text-sm font-bold shadow-lg transition-colors ${
              secondsRemaining < 120
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
                : 'bg-white/5 border-white/15 text-amber-300'
            }`}
          >
            <Timer className="w-4 h-4" />
            <span>{formatTimer(secondsRemaining)}</span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-sans font-medium">
              Time Left
            </span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-16 text-center shadow-2xl">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white">Summoning the Semester Boss...</h3>
            <p className="text-xs text-zinc-400 mt-1">Compiling 15 comprehensive syllabus questions</p>
          </div>
        )}

        {/* Active Battle Arena */}
        {!loading && currentQ && !concluded && (
          <div className="space-y-6">
            {/* Boss Arena Card */}
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-zinc-900/90 via-black to-zinc-950 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
              <div className="absolute top-0 right-1/4 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

              {/* Boss Header & HP Bar */}
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  {/* Boss Avatar / Sprite */}
                  <div
                    className={`w-20 h-20 rounded-3xl bg-rose-500/10 border-2 border-rose-500/30 flex items-center justify-center text-5xl shadow-2xl transition-transform duration-200 select-none ${
                      bossShake ? 'scale-90 rotate-3 bg-rose-500/30 border-rose-400' : 'hover:scale-105'
                    }`}
                  >
                    🐉
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-wider">
                        Raid Boss
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">15 Questions Sprint</span>
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      The Semester Gorgon
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Core Syllabus • Data Structures, Algorithms, DBMS, OS & Networks
                    </p>
                  </div>
                </div>

                {/* Animated Health Gauge */}
                <div className="w-full md:w-64 bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-1.5 text-xs font-mono">
                    <span className="text-zinc-400 font-medium flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                      Boss HP
                    </span>
                    <span className="text-white font-bold">{bossHp} / 100</span>
                  </div>

                  {/* HP Progress Bar */}
                  <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        hpPercent > 50
                          ? 'bg-gradient-to-r from-emerald-500 to-amber-400'
                          : hpPercent > 20
                          ? 'bg-gradient-to-r from-amber-400 to-rose-500'
                          : 'bg-rose-500 animate-pulse'
                      }`}
                      style={{ width: `${hpPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Slash / Damage Impact Effect */}
              {slashEffect && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none animate-ping">
                  <span className="text-4xl font-black text-rose-400 tracking-widest font-mono">
                    💥 CRITICAL SLASH! -7 HP
                  </span>
                </div>
              )}
            </div>

            {/* Question Stage Card */}
            <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6 md:p-8 backdrop-blur-xl shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-zinc-300 border border-white/10">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  {currentQ.module}
                </span>
              </div>

              <h3 className="text-lg md:text-xl font-bold text-white mb-6 leading-snug">
                {currentQ.question}
              </h3>

              {/* 4 Options Grid */}
              <div className="space-y-3">
                {currentQ.options.map((option, idx) => {
                  const letters = ['A', 'B', 'C', 'D'];
                  return (
                    <button
                      key={idx}
                      disabled={submittingAnswer || !!feedback}
                      onClick={() => handleSelectOption(idx)}
                      className={`w-full p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                        feedback
                          ? 'bg-white/5 border-white/10 text-zinc-400 cursor-default'
                          : 'bg-white/5 hover:bg-white/10 border-white/15 hover:border-amber-400/40 text-white cursor-pointer active:scale-[0.99]'
                      }`}
                    >
                      <span className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center font-bold text-xs font-mono text-zinc-300 flex-shrink-0">
                        {letters[idx]}
                      </span>
                      <span className="text-sm font-medium pt-0.5">{option}</span>
                    </button>
                  );
                })}
              </div>

              {/* Feedback Drawer */}
              {feedback && (
                <div
                  className={`mt-6 p-4 rounded-2xl border animate-in fade-in ${
                    feedback.isCorrect
                      ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                      : 'bg-rose-500/10 border-rose-400/30 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5 font-bold text-sm">
                    {feedback.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span>Direct Hit! -7 HP damage dealt to the Gorgon.</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-rose-400" />
                        <span>Defended! The Gorgon deflected your spell.</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed pl-7">
                    {feedback.explanation}
                  </p>

                  {/* Next Question Button if not completed */}
                  {currentIndex < questions.length - 1 && bossHp > 0 && (
                    <button
                      onClick={handleNextQuestion}
                      className="mt-3 ml-7 px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Proceed to Next Attack</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Final Victory / Defeat Screen */}
        {concluded && finalResult && (
          <div className="rounded-3xl border border-white/15 bg-zinc-950 p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden">
            {finalResult.won ? (
              <div>
                <div className="w-20 h-20 rounded-3xl bg-amber-400/20 border-2 border-amber-400/40 mx-auto flex items-center justify-center text-4xl mb-4 animate-bounce">
                  ⚔️
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20 uppercase tracking-widest">
                  Boss Slayed
                </span>
                <h2 className="text-3xl md:text-4xl font-black text-white mt-2">
                  Victory! You Defeated the Gorgon!
                </h2>
                <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto">
                  Outstanding revision performance! You mastered the semester core syllabus with{' '}
                  <span className="text-white font-bold">{finalResult.scorePercentage}%</span> accuracy.
                </p>

                {/* Rewards Unlocked Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto mt-6">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <Zap className="w-6 h-6 text-amber-400 mx-auto mb-1" />
                    <span className="text-xs text-zinc-400 block">Ledger Reward</span>
                    <span className="text-xl font-black text-white font-mono">
                      +{finalResult.xpAwarded} XP
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <Trophy className="w-6 h-6 text-amber-400 mx-auto mb-1" />
                    <span className="text-xs text-zinc-400 block">Badge Unlocked</span>
                    <span className="text-sm font-bold text-amber-300">
                      Boss Slayer (⚔️)
                    </span>
                  </div>
                </div>

                <div className="flex justify-center gap-4 mt-8">
                  <Link
                    href="/student/rewards"
                    className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition-colors shadow-lg shadow-amber-400/20"
                  >
                    Spend XP in Rewards Store
                  </Link>
                  <Link
                    href="/student/play"
                    className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs transition-colors"
                  >
                    Return to Play Hub
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-500/40 mx-auto flex items-center justify-center text-4xl mb-4">
                  💀
                </div>
                <h2 className="text-3xl font-black text-white">The Gorgon Prevailed</h2>
                <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto">
                  You scored <span className="text-white font-bold">{finalResult.scorePercentage}%</span>.
                  The semester exam raid requires at least 70% accuracy to slay the Boss.
                </p>
                <div className="flex justify-center gap-4 mt-6">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Try Raid Again</span>
                  </button>
                  <Link
                    href="/student/learn"
                    className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs transition-colors"
                  >
                    Review Daily Quiz Syllabus
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
