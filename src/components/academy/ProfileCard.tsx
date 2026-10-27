'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Trash2, ExternalLink, RotateCw, AlertTriangle, ShieldCheck, MousePointer, Crosshair } from 'lucide-react';
import { StudentProfile } from '@/data/studentDashboardData';
import Shuffle from '@/components/Shuffle';
import { RankChip } from '@/components/ranks/RankChip';
import FlipCard from '@/components/FlipCard';
import { createClient } from '@/lib/supabase/client';
import {
  getCursorPreference,
  setCursorPreference,
  CURSOR_PREFERENCE_EVENT,
  CursorPreference,
} from '@/lib/cursor-preference';

interface ProfileCardProps {
  profile: StudentProfile;
  onUpdateAvatar?: (newUrl: string | null) => void;
}

const STORAGE_KEY = 'academy_student_avatar';

export function ProfileCard({ profile, onUpdateAvatar }: ProfileCardProps) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cursorPreference, setCursorPreferenceState] = useState<CursorPreference>('target');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate avatar from localStorage on client mount
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setAvatarUrl(saved);
      } catch {
        // Storage access blocked or unavailable
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Hydrate and sync cursor preference
  useEffect(() => {
    setCursorPreferenceState(getCursorPreference());

    const handlePreferenceChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ preference?: CursorPreference }>;
      const nextPref = customEvent?.detail?.preference || getCursorPreference();
      setCursorPreferenceState(nextPref);
    };

    window.addEventListener(CURSOR_PREFERENCE_EVENT, handlePreferenceChange);
    return () => {
      window.removeEventListener(CURSOR_PREFERENCE_EVENT, handlePreferenceChange);
    };
  }, []);

  const handleToggleCursor = (newPref: CursorPreference) => {
    setCursorPreference(newPref);
    setCursorPreferenceState(newPref);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Please upload a JPG, PNG, or WebP image.');
      return;
    }

    // Validate size (< 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      setErrorMsg('Image file size must be less than 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      setAvatarUrl(result);
      try {
        localStorage.setItem(STORAGE_KEY, result);
      } catch {
        console.warn('LocalStorage limit reached for avatar image.');
      }
      onUpdateAvatar?.(result);

      // Persist to Supabase profiles table if authenticated
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({ avatar_url: result })
            .eq('id', user.id);
        }
      } catch (err) {
        console.warn('Supabase profile avatar update failed:', err);
      }
    };
    reader.readAsDataURL(file);
    // Reset input value so re-selecting the same file triggers onChange
    e.target.value = '';
  };

  const handleRemoveAvatar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setErrorMsg(null);
    setAvatarUrl(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onUpdateAvatar?.(null);

    // Persist removal to Supabase profiles table if authenticated
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ avatar_url: null })
          .eq('id', user.id);
      }
    } catch (err) {
      console.warn('Supabase profile avatar clear failed:', err);
    }
  };

  // Front Face: Clean player card where pfp covers the entire front
  const frontContent = (
    <div className="w-full h-full p-4 flex flex-col justify-between select-none relative overflow-hidden rounded-[22px] border border-white/15 bg-black">
      {/* Full-bleed Profile Picture / Background Cover */}
      {avatarUrl ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt={profile.name || 'Student'}
            className="w-full h-full object-cover object-center scale-[1.01]"
            draggable={false}
          />
          {/* Dual subtle gradient overlays for high text contrast and card depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
        </div>
      ) : (
        <div className="absolute inset-0 w-full h-full overflow-hidden bg-gradient-to-b from-[#18181b] via-[#0f0f12] to-black flex flex-col items-center justify-center">
          <div className="w-24 h-24 rounded-3xl bg-white/[0.04] border border-white/15 flex items-center justify-center text-5xl shadow-2xl shadow-black/80 mb-3">
            👨‍🎓
          </div>
          <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
            CODAK Identity
          </span>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 pointer-events-none" />
        </div>
      )}

      {/* Top Header Floating Badges */}
      <div className="flex items-center justify-between text-xs z-10 relative">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-mono uppercase tracking-wider text-zinc-300 shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span>Student Card</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-mono text-zinc-200 shadow-md">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Active</span>
        </div>
      </div>

      {/* Bottom Floating Identity & Rank Information */}
      <div className="w-full text-center z-10 relative pb-1">
        <div className="drop-shadow-lg">
          {profile.name ? (
            <Shuffle
              key={profile.name}
              text={profile.name}
              tag="h2"
              effect="slide"
              duration={0.35}
              stagger={0.03}
              triggerOnHover={true}
              color="#FFFFFF"
              accentColor="#D4D4D8"
              style={{ fontSize: '1.25rem', letterSpacing: '0.02em', fontWeight: 700 }}
            />
          ) : (
            <h2
              style={{ fontSize: '1.25rem', letterSpacing: '0.02em', fontWeight: 700 }}
              className="text-white"
            >
              Student
            </h2>
          )}
        </div>

        <div className="mt-2 flex items-center justify-center gap-2">
          <div className="backdrop-blur-md bg-black/60 rounded-full border border-white/15 p-0.5">
            <RankChip level={profile.level} size="sm" showLevel />
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[11px] font-mono text-zinc-200 shadow-sm">
            🏆 {profile.rank}
          </span>
        </div>
      </div>
    </div>
  );

  // Back Face: Edit Profile options
  const backContent = (
    <div className="w-full h-full p-4 flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-[#141416] via-[#0e0e11] to-[#070709] border border-white/10 rounded-[22px] text-left">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            <span>Edit Profile</span>
          </h3>
          <p className="text-[10px] text-zinc-400 font-mono">Avatar & Account</p>
        </div>
        <button
          type="button"
          data-no-flip
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setIsFlipped(false);
          }}
          className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white transition-all text-[10px] flex items-center gap-1 cursor-pointer"
          title="Flip back to front"
        >
          <RotateCw className="w-3 h-3" />
          <span className="font-mono">Front</span>
        </button>
      </div>

      {/* Avatar Preview & Photo Editing Controls */}
      <div className="py-2.5 flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-2xl p-3">
        <label
          htmlFor="profile-photo-upload"
          data-no-flip
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/20 hover:border-white/50 bg-zinc-950 shrink-0 flex items-center justify-center cursor-pointer group transition-all"
          title="Click to select new photo"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          ) : (
            <span className="text-2xl">👨‍🎓</span>
          )}
        </label>
        <div className="flex-1 min-w-0 space-y-1.5">
          <label
            htmlFor="profile-photo-upload"
            data-no-flip
            role="button"
            tabIndex={0}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                fileInputRef.current?.click();
              }
            }}
            className="w-full py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer select-none"
          >
            <Camera className="w-3.5 h-3.5 text-zinc-300" />
            <span>{avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
          </label>

          {avatarUrl && (
            <button
              type="button"
              data-no-flip
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleRemoveAvatar}
              className="w-full py-1 px-2 rounded-lg text-[10px] text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove Photo</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Profile Summary */}
      <div className="space-y-1.5 text-xs font-mono bg-black/40 border border-white/5 p-3 rounded-2xl">
        <div className="flex justify-between items-center text-zinc-400 text-[11px]">
          <span>Player:</span>
          <span className="text-white font-medium truncate max-w-[150px]">{profile.name || 'Student'}</span>
        </div>
        <div className="flex justify-between items-center text-zinc-400 text-[11px]">
          <span>Level:</span>
          <span className="text-white font-medium">LVL {profile.level}</span>
        </div>
        <div className="flex justify-between items-center text-zinc-400 text-[11px]">
          <span>Rank Tier:</span>
          <span className="text-white font-medium">{profile.rank}</span>
        </div>
        <div className="pt-1.5 border-t border-white/10 flex justify-between items-center text-[11px]" data-no-flip>
          <span className="text-zinc-400 flex items-center gap-1.5">
            {cursorPreference === 'default' ? (
              <MousePointer className="w-3 h-3 text-zinc-300" />
            ) : (
              <Crosshair className="w-3 h-3 text-zinc-300" />
            )}
            Cursor:
          </span>
          <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10" data-no-flip>
            <button
              type="button"
              data-no-flip
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCursor('default');
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                cursorPreference === 'default'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Turn cursor back to default OS pointer"
            >
              Default
            </button>
            <button
              type="button"
              data-no-flip
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCursor('target');
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                cursorPreference === 'target'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Use custom target cursor HUD"
            >
              Target
            </button>
          </div>
        </div>
      </div>

      {/* Error Message if Validation Fails */}
      {errorMsg && (
        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Link to Full Academic Profile */}
      <div className="pt-1">
        <Link
          href="/student/profile"
          data-no-flip
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            router.push('/student/profile');
          }}
          className="w-full py-2 px-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer select-none"
        >
          <span>Full Academic Profile</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        id="profile-photo-upload"
        aria-label="Upload profile photo"
      />

      {/* FlipCard Component */}
      <FlipCard
        front={frontContent}
        back={backContent}
        flipped={isFlipped}
        onFlipChange={setIsFlipped}
        axis="y"
        flipOnClick={true}
        draggable={true}
        dragDistance={0}
        tilt={true}
        tiltMax={10}
        glare={true}
        glareOpacity={0.2}
        hoverScale={1.02}
        perspective={1100}
        stiffness={180}
        damping={20}
        width="100%"
        height={415}
        radius={22}
        background="#0c0c0e"
        color="#f5f5f5"
        shadow={true}
        shadowColor="#000000"
        shadowOpacity={0.5}
        ariaLabel="Student Profile Flip Card"
      />
    </div>
  );
}

export default ProfileCard;
