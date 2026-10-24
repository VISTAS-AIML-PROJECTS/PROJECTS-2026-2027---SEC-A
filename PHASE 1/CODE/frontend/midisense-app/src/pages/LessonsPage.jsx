import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import useLessonStore from '../store/useLessonStore';
import { UNITS, LESSONS, getLessonsByUnit, getOrderedLessonIds } from '../data/lessons';

// Ordered IDs used for unlock checks — computed once
const ORDERED_IDS = getOrderedLessonIds();

// Unit accent palette — maps unit color token to Tailwind classes
const UNIT_PALETTE = {
  indigo: {
    border:     'border-indigo-500/40',
    icon:       'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
    title:      'text-indigo-300',
    badge:      'bg-indigo-500/20 text-indigo-300',
    connector:  'bg-indigo-500/25',
    progress:   'bg-indigo-500',
  },
  violet: {
    border:     'border-violet-500/40',
    icon:       'bg-violet-500/15 border-violet-500/30 text-violet-300',
    title:      'text-violet-300',
    badge:      'bg-violet-500/20 text-violet-300',
    connector:  'bg-violet-500/25',
    progress:   'bg-violet-500',
  },
  amber: {
    border:     'border-amber-500/40',
    icon:       'bg-amber-500/15 border-amber-500/30 text-amber-300',
    title:      'text-amber-300',
    badge:      'bg-amber-500/20 text-amber-300',
    connector:  'bg-amber-500/25',
    progress:   'bg-amber-500',
  },
  emerald: {
    border:     'border-emerald-500/40',
    icon:       'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    title:      'text-emerald-300',
    badge:      'bg-emerald-500/20 text-emerald-300',
    connector:  'bg-emerald-500/25',
    progress:   'bg-emerald-500',
  },
  rose: {
    border:     'border-rose-500/40',
    icon:       'bg-rose-500/15 border-rose-500/30 text-rose-300',
    title:      'text-rose-300',
    badge:      'bg-rose-500/20 text-rose-300',
    connector:  'bg-rose-500/25',
    progress:   'bg-rose-500',
  },
};

// ── LessonCard ──────────────────────────────────────────────────────────────

function LessonCard({ lesson, unitColor, isCompleted, isUnlocked, index }) {
  const navigate = useNavigate();
  const palette  = UNIT_PALETTE[unitColor] ?? UNIT_PALETTE.indigo;

  const handleClick = () => {
    if (isUnlocked) navigate(`/lessons/${lesson.id}`);
  };

  return (
    <div className="flex items-start gap-4">
      {/* ── Step number / state indicator ── */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
            border-2 transition-all duration-300
            ${isCompleted
              ? 'bg-indigo-500 border-indigo-400 text-white shadow-[0_0_14px_3px_rgba(99,102,241,0.5)]'
              : isUnlocked
                ? `border-white/20 bg-white/8 text-slate-300`
                : 'border-white/8 bg-transparent text-slate-700'
            }
          `}
        >
          {isCompleted ? '✓' : isUnlocked ? index + 1 : '🔒'}
        </div>
      </div>

      {/* ── Card ── */}
      <button
        type="button"
        onClick={handleClick}
        disabled={!isUnlocked}
        aria-label={`${lesson.title}${!isUnlocked ? ' (locked)' : ''}`}
        className={`
          group flex-1 text-left glass-card p-4 sm:p-5
          border transition-all duration-200
          ${isCompleted
            ? 'border-indigo-500/30 hover:border-indigo-500/50'
            : isUnlocked
              ? `${palette.border} hover:bg-white/6 cursor-pointer`
              : 'border-white/4 opacity-45 cursor-not-allowed'
          }
          ${isUnlocked && !isCompleted ? 'hover:scale-[1.01]' : ''}
        `}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-semibold text-sm sm:text-base leading-snug
                ${isCompleted ? 'text-slate-200' : isUnlocked ? 'text-slate-200' : 'text-slate-600'}
              `}>
                {lesson.title}
              </h3>
              {isCompleted && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                  Done
                </span>
              )}
            </div>

            {/* One-line teaser — only when unlocked */}
            {isUnlocked && (lesson.teaser || lesson.description) && (
              <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                {lesson.teaser ?? lesson.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] text-slate-600">
                ⏱ {lesson.estimatedMinutes} min
              </span>
              <span className="text-[10px] text-slate-600">
                {lesson.steps.length} {lesson.steps.length === 1 ? 'step' : 'steps'}
              </span>
            </div>
          </div>

          {/* Chevron / lock */}
          {isUnlocked && (
            <div className={`
              flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
              transition-all duration-200
              ${isCompleted
                ? 'bg-indigo-500/15 text-indigo-400 group-hover:bg-indigo-500/25'
                : 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-slate-200'
              }
            `}>
              <span className="text-sm">{isCompleted ? '↩' : '→'}</span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

// ── CircularProgress ─────────────────────────────────────────────────────────

function CircularProgress({ pct, color, size = 52 }) {
  const radius     = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset     = circumference - (pct / 100) * circumference;
  const STROKE_MAP = {
    indigo:  { track: '#312e81', fill: '#6366f1' },
    violet:  { track: '#3b0764', fill: '#8b5cf6' },
    amber:   { track: '#451a03', fill: '#f59e0b' },
    emerald: { track: '#064e3b', fill: '#10b981' },
    rose:    { track: '#4c0519', fill: '#f43f5e' },
  };
  const { track, fill } = STROKE_MAP[color] ?? STROKE_MAP.indigo;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="flex-shrink-0"
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={track}
        strokeWidth="4"
      />
      {/* Fill arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={fill}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.4,0,0.2,1)' }}
      />
      {/* Percentage text */}
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill={fill}
      >
        {pct}%
      </text>
    </svg>
  );
}

// ── UnitSection ─────────────────────────────────────────────────────────────

function UnitSection({ unit, lessons, completedIds, unitIndex }) {
  const palette    = UNIT_PALETTE[unit.color] ?? UNIT_PALETTE.indigo;
  const isUnlocked = useLessonStore((s) => s.isUnlocked);
  const completed  = lessons.filter((l) => completedIds.has(l.id)).length;
  const total      = lessons.length;
  const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <section
      id={`unit-${unit.id}`}
      aria-label={`Unit ${unitIndex + 1}: ${unit.title}`}
      className="lesson-section"
    >
      {/* ── Unit header ── */}
      <div className={`glass-card p-5 border ${palette.border} mb-4`}>
        <div className="flex items-center gap-4">
          {/* Circular progress ring */}
          <CircularProgress pct={pct} color={unit.color} size={56} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${palette.title}`}>
                Unit {unitIndex + 1}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${palette.badge}`}>
                {completed}/{total} lessons
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100 mt-0.5">
              {unit.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {unit.teaser ?? unit.description}
            </p>

            {/* Thin flat progress bar below ring */}
            <div className="mt-2.5 h-1 rounded-full bg-white/8 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${palette.progress}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Lesson cards ── */}
      <div className="pl-2 space-y-2 relative">
        {lessons.map((lesson, i) => {
          const done      = completedIds.has(lesson.id);
          const unlocked  = isUnlocked(lesson.id, ORDERED_IDS);
          return (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              unitColor={unit.color}
              isCompleted={done}
              isUnlocked={unlocked}
              index={i}
            />
          );
        })}
      </div>
    </section>
  );
}


// ── LessonsPage ──────────────────────────────────────────────────────────────

export default function LessonsPage() {
  const navigate      = useNavigate();
  const user          = useAuthStore((s) => s.user);
  const completedIds  = useLessonStore((s) => s.completedIds);
  const loading       = useLessonStore((s) => s.loading);
  const fetchProgress = useLessonStore((s) => s.fetchProgress);

  // Load progress once the user is available
  useEffect(() => {
    if (user?.uid) fetchProgress(user.uid);
  }, [user?.uid, fetchProgress]);

  const totalLessons    = LESSONS.length;
  const completedCount  = completedIds.size;
  const overallPct      = Math.round((completedCount / totalLessons) * 100);

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(ellipse at 15% 0%, rgba(99,102,241,0.14) 0%, transparent 55%), ' +
          'radial-gradient(ellipse at 85% 100%, rgba(167,139,250,0.08) 0%, transparent 50%), ' +
          '#0f0f1a',
      }}
    >
      {/* ── Top nav ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/6 bg-black/30 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 group"
          aria-label="Go to dashboard"
        >
          <span className="text-xl">🎹</span>
          <span className="font-bold text-slate-200 text-base hidden sm:block group-hover:text-indigo-300 transition-colors">
            MIDISense
          </span>
        </button>

        <nav className="flex items-center gap-1" aria-label="Main navigation">
          <button
            type="button"
            onClick={() => navigate('/lessons')}
            aria-current="page"
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/30"
          >
            Lessons
          </button>
          <button
            type="button"
            onClick={() => navigate('/practice')}
            className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/6 transition-colors"
          >
            Practice
          </button>
        </nav>
      </header>

      {/* ── Page content ── */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ── Hero header ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100">
              Your Learning Path
            </h1>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed max-w-lg">
            Work through each unit in order. Complete a lesson to unlock the next one.
            Each session takes only 5–12 minutes.
          </p>

          {/* Overall progress strip */}
          {loading ? (
            <div className="h-8 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-600">Loading progress…</span>
            </div>
          ) : (
            <div className="glass-card p-4 flex items-center gap-4 border border-white/8">
              {/* Big number */}
              <div className="text-center flex-shrink-0 w-12">
                <p className="text-2xl font-extrabold text-indigo-400">{overallPct}%</p>
                <p className="text-[10px] text-slate-600">done</p>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
                  <span>{completedCount} of {totalLessons} lessons complete</span>
                  <span>{totalLessons - completedCount} remaining</span>
                </div>
                <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                    style={{ width: `${overallPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Unit sections ── */}
        <div className="space-y-10">
          {UNITS.map((unit, i) => (
            <UnitSection
              key={unit.id}
              unit={unit}
              lessons={getLessonsByUnit(unit.id)}
              completedIds={completedIds}
              unitIndex={i}
            />
          ))}
        </div>

        {/* ── Completion celebration ── */}
        {completedCount === totalLessons && totalLessons > 0 && (
          <div className="glass-card p-8 text-center space-y-3 border border-indigo-500/30">
            <div className="text-5xl">🏆</div>
            <h2 className="text-xl font-bold text-slate-100">
              Curriculum Complete!
            </h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              You've finished all beginner lessons. Keep going — jump into the Practice
              page and put everything you've learned into action.
            </p>
            <button
              type="button"
              onClick={() => navigate('/assessment')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/30 transition-all duration-200"
            >
              Take Beginner Assessment →
            </button>
          </div>
        )}

        <div className="h-12" aria-hidden="true" />
      </main>
    </div>
  );
}
