import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import useLessonStore from '../store/useLessonStore';
import { getUserProfile } from '../firebase/firestore';
import { signOutUser } from '../firebase/auth';
import { getNextLesson, getUnitById } from '../data/lessons';

const LEVEL_META = {
  Beginner:     { emoji: '🌱', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  Intermediate: { emoji: '🎯', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30' },
  Advanced:     { emoji: '🚀', color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/30' },
};

export default function DashboardPage() {
  const navigate  = useNavigate();
  const user      = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);

  const [profile, setProfile]   = useState(null);
  const [fetching, setFetching] = useState(true);

  // Lesson progress
  const completedIds  = useLessonStore((s) => s.completedIds);
  const fetchProgress = useLessonStore((s) => s.fetchProgress);
  const nextLesson    = getNextLesson(completedIds);
  const nextUnit      = nextLesson ? getUnitById(nextLesson.unitId) : null;

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid)
      .then((p) => setProfile(p))
      .finally(() => setFetching(false));
    fetchProgress(user.uid);
  }, [user, fetchProgress]);

  async function handleSignOut() {
    await signOutUser();
    clearUser();
    navigate('/login', { replace: true });
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Musician';
  const level       = profile?.skillLevel ?? 'Beginner';
  const meta        = LEVEL_META[level] ?? LEVEL_META.Beginner;

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-12"
         style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(99,102,241,0.15) 0%, transparent 55%), #0f0f1a' }}>

      <div className="max-w-2xl mx-auto space-y-8">
        {/* ── Header ── */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎹</span>
            <span className="font-bold text-slate-200 text-lg">MIDISense</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/lessons')}
              className="text-sm text-slate-400 hover:text-slate-200 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all"
            >
              Lessons
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-slate-400 hover:text-slate-200 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* ── Welcome card ── */}
        <div className="glass-card p-8 space-y-4">
          <div className="space-y-1">
            <p className="text-slate-400 text-sm font-medium">Welcome back</p>
            <h1 className="text-3xl font-extrabold text-slate-100">{displayName} 👋</h1>
          </div>

          {/* Level badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${meta.bg} ${meta.color}`}>
            <span>{meta.emoji}</span>
            Level: <strong>{level}</strong>
          </div>

          {profile && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                { label: 'Instrument', value: profile.instrument === 'piano' ? '🎹 Piano' : profile.instrument },
                { label: 'Daily goal', value: `${profile.dailyGoalMinutes} min` },
                { label: 'Days/week',  value: `${profile.weeklyGoalDays} days` },
                { label: 'Goals set',  value: `${profile.goals?.length ?? 0}` },
              ].map(({ label, value }) => (
                <div key={label} className="glass-card p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-slate-200">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Practice CTA ── */}
        <div className="glass-card p-8 text-center space-y-4">
          <div className="text-5xl">🎹</div>
          <h2 className="text-xl font-bold text-slate-200">Ready to practice?</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Jump into a live session — play on the on-screen keyboard, get real-time tips,
            and chat with your AI tutor.
          </p>
          <button
            type="button"
            onClick={() => navigate('/practice')}
            className="
              inline-flex items-center gap-2 px-6 py-3 rounded-xl
              bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
              text-white font-semibold text-sm
              shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50
              transition-all duration-200
            "
          >
            <span>Start Practice Session</span>
            <span>→</span>
          </button>
        </div>

        {/* ── Sequencer CTA ── */}
        <div className="glass-card p-6 flex items-center gap-5 border border-violet-500/20">
          <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/30
                          flex items-center justify-center text-2xl flex-shrink-0">
            🎛️
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-400">New</p>
            <h2 className="text-sm font-bold text-slate-100 mt-0.5">Piano Roll Sequencer</h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Compose multi-track MIDI, draw notes, record live, generate AI basslines & chords.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/sequencer')}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl
                       bg-violet-600 hover:bg-violet-500 active:bg-violet-700
                       text-white font-semibold text-xs
                       shadow-lg shadow-violet-500/30 transition-all duration-200"
          >
            Open →
          </button>
        </div>

        {/* ── Continue Learning card ── */}
        {nextLesson ? (
          <div className="glass-card p-6 border border-indigo-500/20 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">{nextUnit?.icon ?? '🎵'}</span>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                Continue Learning
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-500">{nextUnit?.title}</p>
              <h2 className="text-base font-bold text-slate-100">{nextLesson.title}</h2>
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                {nextLesson.description}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-600">⏱ {nextLesson.estimatedMinutes} min · {nextLesson.steps.length} steps</span>
              <button
                type="button"
                onClick={() => navigate(`/lessons/${nextLesson.id}`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-500/20 transition-all duration-200"
              >
                Start Lesson →
              </button>
            </div>
          </div>
        ) : (
          /* All lessons done — show a celebration nudge */
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
        )}
      </div>
    </div>
  );
}
