import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import useLessonStore from '../store/useLessonStore';
import { getUserProfile } from '../firebase/firestore';
import { signOutUser } from '../firebase/auth';
import { getNextLesson, getUnitById } from '../data/lessons';

// ── Skill-level cosmetics ─────────────────────────────────────────────────────
const LEVEL_META = {
  Beginner:     { emoji: '🌱', color: 'text-emerald-400', ring: 'ring-emerald-500/40' },
  Intermediate: { emoji: '🎯', color: 'text-amber-400',   ring: 'ring-amber-500/40'   },
  Advanced:     { emoji: '🚀', color: 'text-violet-400',  ring: 'ring-violet-500/40'  },
};

// ── Avatar initials helper ────────────────────────────────────────────────────
function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ── Nav card data ─────────────────────────────────────────────────────────────
const NAV_CARDS = [
  {
    id: 'practice',
    to: '/practice',
    emoji: '🎹',
    title: 'Practice',
    subtitle: 'Live session with AI tutor',
    description:
      'Jump onto the interactive keyboard, receive real-time note feedback, and chat with your personal AI coach.',
    gradient: 'from-indigo-600/30 via-indigo-500/10 to-transparent',
    border: 'border-indigo-500/30',
    glow: 'hover:shadow-indigo-500/20',
    badge: null,
    disabled: false,
  },
  {
    id: 'lessons',
    to: '/lessons',
    emoji: '📚',
    title: 'Lessons',
    subtitle: 'Guided curriculum',
    description:
      'Work through structured lessons covering theory, technique, and ear training — all paced to your skill level.',
    gradient: 'from-violet-600/30 via-violet-500/10 to-transparent',
    border: 'border-violet-500/30',
    glow: 'hover:shadow-violet-500/20',
    badge: null,
    disabled: false,
  },
  {
    id: 'sequencer',
    to: '/sequencer',
    emoji: '🎛️',
    title: 'Sequencer',
    subtitle: 'Compose & record',
    description:
      'Piano-roll MIDI sequencer — compose multi-track pieces, record live, and export MIDI.',
    gradient: 'from-fuchsia-600/30 via-violet-500/10 to-transparent',
    border: 'border-fuchsia-500/30',
    glow: 'hover:shadow-fuchsia-500/20',
    badge: null,
    disabled: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate  = useNavigate();
  const user      = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);

  const [profile,    setProfile]   = useState(null);
  const [fetching,   setFetching]  = useState(true);
  const [dropOpen,   setDropOpen]  = useState(false);

  // Lesson progress
  const completedIds  = useLessonStore((s) => s.completedIds);
  const fetchProgress = useLessonStore((s) => s.fetchProgress);
  const nextLesson    = getNextLesson(completedIds);
  const nextUnit      = nextLesson ? getUnitById(nextLesson.unitId) : null;

  // Close dropdown on outside click
  const dropRef = useRef(null);
  useEffect(() => {
    function onOutside(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  // Load profile + lesson progress
  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid)
      .then((p) => setProfile(p))
      .catch((err) => {
        console.warn('Profile fetch handled:', err?.message);
        setProfile(null);
      })
      .finally(() => setFetching(false));
    fetchProgress(user.uid);
  }, [user, fetchProgress]);

  async function handleSignOut() {
    setDropOpen(false);
    await signOutUser();
    clearUser();
    navigate('/login', { replace: true });
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Musician';
  const initials    = getInitials(displayName);
  const email       = user?.email ?? '';
  const level       = profile?.skillLevel ?? 'Beginner';
  const meta        = LEVEL_META[level] ?? LEVEL_META.Beginner;
  const mode        = profile?.mode ?? 'learning';
  const productionUnlocked =
    mode === 'production' ||
    level !== 'Beginner' ||
    profile?.assessmentPassed === true;

  // ── Loading state ────────────────────────────────────────────────────────
  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a]">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.18) 0%, transparent 55%), ' +
          'radial-gradient(ellipse at 80% 100%, rgba(167,139,250,0.10) 0%, transparent 50%), ' +
          '#0f0f1a',
      }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4"
        style={{ background: 'rgba(15,15,26,0.75)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 select-none">
          <span className="text-2xl">🎹</span>
          <span className="font-bold text-slate-100 text-lg tracking-tight">MIDISense</span>
        </div>

        {/* Avatar + dropdown */}
        <div className="relative" ref={dropRef}>
          <button
            type="button"
            aria-label="Open profile menu"
            aria-haspopup="true"
            aria-expanded={dropOpen}
            onClick={() => setDropOpen((v) => !v)}
            className={`
              w-10 h-10 rounded-full ring-2 ${meta.ring}
              bg-indigo-600 flex items-center justify-center
              text-white font-bold text-sm select-none
              transition-all duration-200 hover:scale-105 hover:ring-4
              focus:outline-none focus:ring-4 focus:ring-indigo-500/60
            `}
          >
            {initials || '?'}
          </button>

          {/* Dropdown panel */}
          {dropOpen && (
            <div
              role="menu"
              className="
                absolute right-0 mt-3 w-64
                glass-card shadow-2xl shadow-black/60
                border border-white/10 overflow-hidden
                home-dropdown
              "
            >
              {/* User info */}
              <div className="px-5 py-4 border-b border-white/8">
                <p className="text-sm font-semibold text-slate-100 truncate">{displayName}</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{email}</p>
                <div className={`inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full text-xs font-semibold
                  bg-white/5 border border-white/10 ${meta.color}`}>
                  <span>{meta.emoji}</span>
                  {level}
                </div>
              </div>

              {/* Actions */}
              <div className="p-2">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="
                    w-full text-left px-3 py-2.5 rounded-lg text-sm
                    text-rose-400 hover:bg-rose-500/10
                    transition-colors duration-150 flex items-center gap-2
                  "
                >
                  <span>↩</span>
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">

        {/* Welcome heading */}
        <section className="space-y-1">
          <p className="text-slate-500 text-sm font-medium">Welcome back</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100">
            Hey, {displayName} 👋
          </h1>
          <p className="text-slate-400 text-sm pt-1">Where would you like to go today?</p>
        </section>

        {/* ── 3 Nav cards ─────────────────────────────────────────────── */}
        <section aria-label="Main navigation" className="grid gap-4 sm:grid-cols-3">
          {NAV_CARDS.map((card) => {
            const isDisabled =
              card.id === 'sequencer' ? !productionUnlocked : card.disabled;
            
            const inner = (
              <div
                className={`
                  relative glass-card p-6 h-full flex flex-col gap-3
                  border ${card.border}
                  bg-gradient-to-br ${card.gradient}
                  transition-all duration-200
                  ${isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : `cursor-pointer hover:-translate-y-1 hover:shadow-xl ${card.glow} hover:border-white/20`
                  }
                `}
              >
                {/* Coming-soon badge */}
                {card.badge && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider
                    bg-white/10 border border-white/15 text-slate-400 px-2 py-0.5 rounded-full">
                    {card.badge}
                  </span>
                )}

                <div className="text-4xl">{card.emoji}</div>

                <div className="flex-1 space-y-1">
                  <h2 className="text-base font-bold text-slate-100">{card.title}</h2>
                  <p className="text-xs font-medium text-slate-400">{card.subtitle}</p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1 hidden sm:block">
                    {card.description}
                  </p>
                </div>

                {!isDisabled && (
                  <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1 mt-1">
                    Open <span>→</span>
                  </span>
                )}
              </div>
            );

            return isDisabled ? (
              <div key={card.id} aria-disabled="true">
                {inner}
              </div>
            ) : (
              <Link
                key={card.id}
                to={card.to}
                className="block h-full no-underline"
                aria-label={`Go to ${card.title}`}
              >
                {inner}
              </Link>
            );
          })}
        </section>

        {/* ── Continue Learning ────────────────────────────────────────── */}
        {nextLesson ? (
          <section aria-label="Continue learning">
            <div className="glass-card p-6 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{nextUnit?.icon ?? '🎵'}</span>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
                    Continue Learning
                  </p>
                </div>
                <p className="text-xs text-slate-500">{nextUnit?.title}</p>
                <h2 className="text-sm font-bold text-slate-100">{nextLesson.title}</h2>
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {nextLesson.description}
                </p>
                <p className="text-[11px] text-slate-600 pt-1">
                  ⏱ {nextLesson.estimatedMinutes} min · {nextLesson.steps.length} steps
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/lessons/${nextLesson.id}`)}
                className="
                  shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl
                  bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
                  text-white font-semibold text-sm
                  shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40
                  transition-all duration-200
                "
              >
                Start Lesson →
              </button>
            </div>
          </section>
        ) : (
          /* All lessons done */
          <section>
            <div className="glass-card p-6 border border-indigo-500/20 text-center space-y-3">
              <div className="text-3xl">🏆</div>
              <p className="text-sm font-semibold text-slate-200">All lessons complete!</p>
              <button
                type="button"
                onClick={() => navigate('/lessons')}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Review your lessons →
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
