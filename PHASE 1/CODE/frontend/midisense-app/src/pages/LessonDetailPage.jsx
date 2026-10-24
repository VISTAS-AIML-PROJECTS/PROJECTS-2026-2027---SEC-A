/**
 * LessonDetailPage.jsx
 * --------------------
 * Route: /lessons/:lessonId
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import useLessonStore from '../store/useLessonStore';
import usePracticeStore from '../store/usePracticeStore';

import {
  getLessonById,
  getUnitById,
  getNextLessonAfter,
  getOrderedLessonIds,
  noteNameToMidi,
} from '../data/lessons';

import PianoKeyboard from '../components/practice/PianoKeyboard';
import FeedbackToast from '../components/practice/FeedbackToast';
import HandVisualization from '../components/lesson/HandVisualization';

const ORDERED_IDS = getOrderedLessonIds();

const UNIT_BADGE = {
  indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const UNIT_PROGRESS_COLOR = {
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
};

function stepIcon(type) {
  switch (type) {
    case 'explain':
      return '📖';
    case 'tip':
      return '💡';
    case 'diagram-note':
      return '🎹';
    case 'play-note':
      return '🎵';
    case 'play-sequence':
      return '🎶';
    default:
      return '•';
  }
}

function stepLabel(type) {
  switch (type) {
    case 'explain':
      return 'Read';
    case 'tip':
      return 'Tip';
    case 'diagram-note':
      return 'Look';
    case 'play-note':
      return 'Play';
    case 'play-sequence':
      return 'Play';
    default:
      return '';
  }
}

function StepContent({ step, tryAgain, seqProgress }) {
  switch (step.type) {
    case 'explain':
      return (
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          {step.text}
        </p>
      );

    case 'tip':
      return (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <span className="text-xl flex-shrink-0 mt-0.5">💡</span>
          <p className="text-sm text-amber-100 leading-relaxed">
            {step.text}
          </p>
        </div>
      );

    case 'diagram-note':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 font-bold text-sm">
              {step.note}
            </div>

            <span className="text-xs text-amber-400 font-semibold">
              Highlighted below ↓
            </span>
          </div>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            {step.text}
          </p>
        </div>
      );

    case 'play-note':
      return (
        <div className="space-y-3">
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            {step.prompt}
          </p>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/8 border border-amber-500/25">
            <div className="w-10 h-10 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center flex-shrink-0">
              <span className="text-amber-300 font-bold text-sm">
                {step.note}
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold text-amber-300">
                Play this note
              </p>

              <p className="text-[11px] text-slate-500 mt-0.5">
                The key is highlighted in amber on the keyboard →
              </p>
            </div>
          </div>

          {tryAgain && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/25 try-again-shake">
              <span className="text-rose-400 text-sm">✗</span>

              <p className="text-xs text-rose-300">
                Not quite — find the amber key and try again!
              </p>
            </div>
          )}
        </div>
      );

    case 'play-sequence':
      return (
        <div className="space-y-3">
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            {step.prompt}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {step.notes.map((note, i) => (
              <div
                key={`${note}-${i}`}
                className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-all duration-200 ${
                  i < seqProgress
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : i === seqProgress
                    ? 'bg-amber-400/20 border-amber-400/50 text-amber-300 ring-1 ring-amber-400/50'
                    : 'bg-white/4 border-white/8 text-slate-600'
                }`}
              >
                {note}
              </div>
            ))}
          </div>

          {tryAgain && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/25 try-again-shake">
              <span className="text-rose-400 text-sm">✗</span>

              <p className="text-xs text-rose-300">
                Not quite — play the amber-highlighted note next!
              </p>
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
}

export default function LessonDetailPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);

  const completedIds = useLessonStore((s) => s.completedIds);
  const loading = useLessonStore((s) => s.loading);
  const fetchProgress = useLessonStore((s) => s.fetchProgress);
  const completeLesson = useLessonStore((s) => s.completeLesson);
  const isUnlocked = useLessonStore((s) => s.isUnlocked);

  const setExpectedNote = usePracticeStore(
    (s) => s.setExpectedNote
  );

  const activateKey = usePracticeStore(
    (s) => s.activateKey
  );

  const deactivateKey = usePracticeStore(
    (s) => s.deactivateKey
  );

  const addToast = usePracticeStore(
    (s) => s.addToast
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const [seqProgress, setSeqProgress] = useState(0);
  const [tryAgain, setTryAgain] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [stepKey, setStepKey] = useState(0);
  const [pressedFinger, setPressedFinger] = useState(null);

  const tryAgainTimer = useRef(null);

  const lesson = getLessonById(lessonId);
  const unit = lesson
    ? getUnitById(lesson.unitId)
    : null;

  const nextLesson = lesson
    ? getNextLessonAfter(lesson.id)
    : null;

  useEffect(() => {
    if (
      user?.uid &&
      completedIds.size === 0 &&
      !loading
    ) {
      fetchProgress(user.uid);
    }
  }, [
    user?.uid,
    completedIds.size,
    loading,
    fetchProgress,
  ]);

  useEffect(() => {
    return () => {
      setExpectedNote(null);

      if (tryAgainTimer.current) {
        clearTimeout(tryAgainTimer.current);
      }
    };
  }, [setExpectedNote]);

  useEffect(() => {
    setCurrentStep(0);
    setJustCompleted(false);
    setStepDone(false);
    setSeqProgress(0);
    setTryAgain(false);
    setStepKey((k) => k + 1);
  }, [lessonId]);

  useEffect(() => {
    if (!lesson) return;

    const current = lesson.steps[currentStep];

    if (!current) return;

    setTryAgain(false);
    setStepDone(false);
    setSeqProgress(0);

    if (current.type === 'play-note') {
      const midi = noteNameToMidi(current.note);

      setExpectedNote(
        midi >= 0 ? midi : null
      );
    } else if (
      current.type === 'play-sequence'
    ) {
      const midi = noteNameToMidi(
        current.notes[0]
      );

      setExpectedNote(
        midi >= 0 ? midi : null
      );
    } else if (
      current.type === 'diagram-note'
    ) {
      const midi = noteNameToMidi(
        current.note
      );

      setExpectedNote(
        midi >= 0 ? midi : null
      );
    } else {
      setExpectedNote(null);
    }
  }, [
    currentStep,
    lesson,
    lessonId,
    setExpectedNote,
  ]);

  const totalSteps =
    lesson?.steps?.length ?? 0;

  const validStepIndex =
    totalSteps > 0
      ? Math.min(
          currentStep,
          totalSteps - 1
        )
      : 0;

  const step =
    lesson?.steps?.[validStepIndex] ??
    null;

  const progressPct =
    totalSteps > 0
      ? Math.round(
          (validStepIndex / totalSteps) * 100
        )
      : 0;

  // ── Target notes used by the accuracy engine ──
  const targetNotes =
    step?.type === 'play-note'
      ? [noteNameToMidi(step.note)].filter(
          (n) => n >= 0
        )
      : step?.type === 'play-sequence'
      ? step.notes
          .map(noteNameToMidi)
          .filter((n) => n >= 0)
      : [];

  const handleNoteOn = useCallback(
    (midiNote, noteName, noteLetter) => {
      if (!step) return;

      activateKey(midiNote);

      setTimeout(
        () => deactivateKey(midiNote),
        200
      );

      if (step.type === 'play-note') {
        const expected =
          noteNameToMidi(step.note);

        if (midiNote === expected) {
          const fingerToAnimate =
            step.finger ?? null;

          if (fingerToAnimate) {
            setPressedFinger(
              fingerToAnimate
            );

            setTimeout(
              () =>
                setPressedFinger(null),
              380
            );
          }

          setStepDone(true);
          setExpectedNote(null);
          setTryAgain(false);

          addToast({
            id: `toast-${Date.now()}-${midiNote}`,
            noteName,
            message: `✓ ${step.note} — great! Click Next to continue.`,
          });
        } else {
          setTryAgain(true);

          if (tryAgainTimer.current) {
            clearTimeout(
              tryAgainTimer.current
            );
          }

          tryAgainTimer.current =
            setTimeout(
              () => setTryAgain(false),
              1500
            );
        }
      } else if (
        step.type === 'play-sequence'
      ) {
        const expectedMidi =
          noteNameToMidi(
            step.notes[seqProgress]
          );

        if (midiNote === expectedMidi) {
          const fingerToAnimate =
            step.fingers?.[
              seqProgress
            ] ?? null;

          if (fingerToAnimate) {
            setPressedFinger(
              fingerToAnimate
            );

            setTimeout(
              () =>
                setPressedFinger(null),
              380
            );
          }

          const next =
            seqProgress + 1;

          setTryAgain(false);

          if (
            next >= step.notes.length
          ) {
            setSeqProgress(next);
            setStepDone(true);
            setExpectedNote(null);

            addToast({
              id: `toast-${Date.now()}-seq`,
              noteName: '✓',
              message:
                'Sequence complete! Click Next to continue.',
            });
          } else {
            setSeqProgress(next);

            const nextMidi =
              noteNameToMidi(
                step.notes[next]
              );

            setExpectedNote(
              nextMidi >= 0
                ? nextMidi
                : null
            );
          }
        } else {
          setTryAgain(true);

          if (tryAgainTimer.current) {
            clearTimeout(
              tryAgainTimer.current
            );
          }

          tryAgainTimer.current =
            setTimeout(
              () => setTryAgain(false),
              1500
            );
        }
      } else {
        addToast({
          id: `toast-${Date.now()}-${midiNote}`,
          noteName,
          message: `${noteName} — keep exploring!`,
        });
      }
    },
    [
      step,
      seqProgress,
      activateKey,
      deactivateKey,
      addToast,
      setExpectedNote,
    ]
  );

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a]">
        <div className="glass-card p-8 text-center space-y-4 max-w-sm">
          <div className="text-4xl">😕</div>

          <p className="text-slate-300 font-semibold">
            Lesson not found
          </p>

          <button
            type="button"
            onClick={() =>
              navigate('/lessons')
            }
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            ← Back to Lessons
          </button>
        </div>
      </div>
    );
  }

  const unlocked = isUnlocked(
    lesson.id,
    ORDERED_IDS
  );

  const completed =
    completedIds.has(lesson.id);

  const badgeCls =
    UNIT_BADGE[unit?.color] ??
    UNIT_BADGE.indigo;

  const progressColor =
    UNIT_PROGRESS_COLOR[unit?.color] ??
    UNIT_PROGRESS_COLOR.indigo;

  if (!unlocked) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          background: '#0f0f1a',
        }}
      >
        <div className="glass-card p-10 text-center space-y-5 max-w-sm border border-white/8">
          <div className="text-5xl">🔒</div>

          <h1 className="text-xl font-bold text-slate-200">
            {lesson.title}
          </h1>

          <p className="text-slate-500 text-sm leading-relaxed">
            Complete the previous lesson to unlock this one.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate('/lessons')
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/30 transition-all"
          >
            ← Back to Lessons
          </button>
        </div>
      </div>
    );
  }

  const isInteractive =
    step?.type === 'play-note' ||
    step?.type === 'play-sequence';

  const canGoNext =
    !isInteractive ||
    stepDone ||
    completed;

  const onLastStep =
    validStepIndex === totalSteps - 1;

  const canComplete =
    onLastStep &&
    (stepDone ||
      !isInteractive ||
      completed) &&
    !completed;

  function goNext() {
    if (!canGoNext) return;

    if (
      validStepIndex <
      totalSteps - 1
    ) {
      setCurrentStep(
        (p) => p + 1
      );

      setStepKey(
        (k) => k + 1
      );
    }
  }

  function goPrev() {
    if (validStepIndex > 0) {
      setCurrentStep(
        (p) => p - 1
      );

      setStepKey(
        (k) => k + 1
      );
    }
  }

  async function handleMarkComplete() {
    if (
      completed ||
      completing
    ) {
      return;
    }

    setCompleting(true);

    await completeLesson(
      user?.uid,
      lesson.id
    );

    setCompleting(false);
    setJustCompleted(true);
    setExpectedNote(null);
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          'radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.12) 0%, transparent 55%), ' +
          'radial-gradient(ellipse at 80% 100%, rgba(167,139,250,0.07) 0%, transparent 50%), ' +
          '#0f0f1a',
      }}
    >
      <FeedbackToast />

      {/* Top nav */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/6 bg-black/30 backdrop-blur-sm flex-shrink-0">

        <button
          type="button"
          onClick={() =>
            navigate('/lessons')
          }
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors group"
          aria-label="Back to Lessons"
        >
          <span className="text-lg transition-transform group-hover:-translate-x-0.5">
            ←
          </span>

          <span className="text-sm font-medium">
            Lessons
          </span>
        </button>

        <div className="hidden sm:flex flex-col items-center gap-0.5">
          {unit && (
            <div
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${badgeCls}`}
            >
              <span>{unit.icon}</span>
              <span>{unit.title}</span>
            </div>
          )}

          <p className="text-xs font-semibold text-slate-400 max-w-[200px] truncate">
            {lesson.title}
          </p>
        </div>

        <nav
          className="flex items-center gap-1"
          aria-label="Main navigation"
        >
          <button
            type="button"
            onClick={() =>
              navigate('/lessons')
            }
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/30"
          >
            Lessons
          </button>

          <button
            type="button"
            onClick={() =>
              navigate('/practice')
            }
            className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/6 transition-colors"
          >
            Practice
          </button>
        </nav>
      </header>

      {/* Split content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* Left panel */}
        <div className="flex-1 lg:max-w-[520px] lg:border-r border-white/6 flex flex-col overflow-y-auto">

          <div className="px-5 sm:px-7 pt-6 pb-4 space-y-2 flex-shrink-0">

            {unit && (
              <div
                className={`sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${badgeCls}`}
              >
                <span>{unit.icon}</span>
                <span>{unit.title}</span>
              </div>
            )}

            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 leading-tight">
              {lesson.title}
            </h1>

            <p className="text-xs text-slate-500 leading-relaxed">
              {lesson.description}
            </p>

            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <span>
                ⏱ {lesson.estimatedMinutes} min
              </span>

              <span>·</span>

              <span>
                {totalSteps} steps
              </span>

              <span>·</span>

              <span className="capitalize">
                {lesson.difficulty}
              </span>

              {completed && (
                <span className="text-indigo-400 font-semibold">
                  · ✓ Complete
                </span>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="px-5 sm:px-7 pb-4 flex-shrink-0">

            <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1.5">
              <span>
                Step {validStepIndex + 1} of {totalSteps}
              </span>

              <span className="capitalize flex items-center gap-1">
                <span>
                  {stepIcon(step.type)}
                </span>

                <span>
                  {stepLabel(step.type)}
                </span>
              </span>
            </div>

            <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
              <div
                className={`h-full rounded-full step-progress-fill ${progressColor}`}
                style={{
                  width: `${Math.max(
                    4,
                    progressPct
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Step */}
          <div
            key={stepKey}
            className="flex-1 px-5 sm:px-7 pb-6 step-animate"
          >
            <StepContent
              step={step}
              tryAgain={tryAgain}
              seqProgress={seqProgress}
            />
          </div>

          {/* Navigation */}
          <div className="flex-shrink-0 px-5 sm:px-7 py-4 border-t border-white/6 flex items-center justify-between gap-3">

            <button
              type="button"
              onClick={goPrev}
              disabled={
                validStepIndex === 0
              }
              className={`
                flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                border transition-all duration-200
                ${
                  validStepIndex === 0
                    ? 'border-white/6 text-slate-700 cursor-not-allowed'
                    : 'border-white/12 text-slate-300 hover:bg-white/6 hover:text-slate-100'
                }
              `}
            >
              ← Prev
            </button>

            <div className="flex items-center gap-1">
              {lesson.steps.map(
                (_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-200 ${
                      i === validStepIndex
                        ? 'w-5 h-1.5 bg-indigo-400'
                        : i <
                          validStepIndex
                        ? 'w-1.5 h-1.5 bg-indigo-500/50'
                        : 'w-1.5 h-1.5 bg-white/12'
                    }`}
                  />
                )
              )}
            </div>

            {onLastStep ? (
              <button
                type="button"
                onClick={
                  handleMarkComplete
                }
                disabled={
                  !canComplete ||
                  completing ||
                  justCompleted ||
                  completed
                }
                id="mark-complete-btn"
                className={`
                  flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                  shadow-lg shadow-indigo-500/20 transition-all duration-200
                  ${
                    canComplete &&
                    !completing &&
                    !completed &&
                    !justCompleted
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : completed ||
                        justCompleted
                      ? 'bg-emerald-600/50 text-emerald-300 cursor-default'
                      : 'bg-white/5 text-slate-600 cursor-not-allowed'
                  }
                `}
              >
                {completing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </>
                ) : completed ||
                  justCompleted ? (
                  <>✓ Complete</>
                ) : (
                  <>✓ Done</>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext}
                className={`
                  flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                  shadow-lg transition-all duration-200
                  ${
                    canGoNext
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25'
                      : 'bg-white/5 text-slate-600 cursor-not-allowed'
                  }
                `}
              >
                {isInteractive &&
                !stepDone &&
                !completed ? (
                  <span className="text-[11px]">
                    Play to unlock →
                  </span>
                ) : (
                  <>Next →</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right keyboard */}
        <div className="lg:flex-1 flex flex-col justify-center px-4 sm:px-6 py-5 lg:py-0 border-t lg:border-t-0 border-white/6 bg-black/10">

          <div className="w-full max-w-2xl mx-auto space-y-3">

            <div className="flex items-center justify-between">

              <p className="text-xs font-bold uppercase tracking-widest text-slate-600">
                Interactive Keyboard
              </p>

              {isInteractive &&
                !stepDone &&
                !completed && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>
                      Wait mode — play the amber key
                    </span>
                  </div>
                )}

              {(stepDone ||
                !isInteractive) && (
                <span className="text-[11px] text-slate-600">
                  Click or press keyboard keys to explore
                </span>
              )}
            </div>

            <div className="glass-card p-3 sm:p-4 border border-white/6">

              <PianoKeyboard
                onNoteOn={handleNoteOn}
                targetNotes={targetNotes}
                expectedNote={
                  step.type ===
                  'diagram-note'
                    ? noteNameToMidi(
                        step.note
                      )
                    : step.type ===
                        'play-note' &&
                      !stepDone
                    ? noteNameToMidi(
                        step.note
                      )
                    : step.type ===
                        'play-sequence' &&
                      !stepDone
                    ? noteNameToMidi(
                        step.notes[
                          seqProgress
                        ]
                      )
                    : null
                }
              />

            </div>

            {/* Hand visualization */}
            {(() => {
              const activeFinger =
                step.type ===
                  'play-note' &&
                !stepDone &&
                !completed
                  ? step.finger ??
                    null
                  : step.type ===
                      'play-sequence' &&
                    !stepDone &&
                    !completed
                  ? step.fingers?.[
                      seqProgress
                    ] ?? null
                  : null;

              return activeFinger ||
                pressedFinger ? (
                <HandVisualization
                  activeFinger={
                    activeFinger
                  }
                  pressedFinger={
                    pressedFinger
                  }
                />
              ) : null;
            })()}

            {/* Context hint */}
            <div className="px-1">

              {step.type ===
                'play-note' &&
                !stepDone &&
                !completed && (
                  <p className="text-[11px] text-slate-600">
                    🎯 Play{' '}
                    <span className="text-amber-400 font-semibold">
                      {step.note}
                    </span>{' '}
                    — it&apos;s highlighted in amber above.
                    You can click it or press the corresponding computer key.
                  </p>
                )}

              {step.type ===
                'play-sequence' &&
                !stepDone &&
                !completed && (
                  <p className="text-[11px] text-slate-600">
                    🎯 Play{' '}
                    <span className="text-amber-400 font-semibold">
                      {
                        step.notes[
                          seqProgress
                        ]
                      }
                    </span>{' '}
                    next (
                    {seqProgress + 1}/
                    {step.notes.length}{' '}
                    notes).
                  </p>
                )}

              {step.type ===
                'diagram-note' && (
                <p className="text-[11px] text-slate-600">
                  👆{' '}
                  <span className="text-amber-400 font-semibold">
                    {step.note}
                  </span>{' '}
                  is highlighted in amber — you can click it to hear it, then press Next when ready.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Completion */}
      {(justCompleted ||
        completed) && (
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-white/6 bg-black/20">

          <div className="max-w-2xl mx-auto glass-card p-5 border border-indigo-500/25 space-y-3">

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white text-lg shadow-[0_0_16px_4px_rgba(99,102,241,0.4)]">
                ✓
              </div>

              <div>
                <p className="font-bold text-slate-100">
                  Lesson Complete!
                </p>

                <p className="text-xs text-slate-500">
                  Your progress has been saved.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">

              {nextLesson ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/lessons/${nextLesson.id}`
                    )
                  }
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/30 transition-all duration-200"
                >
                  Next Lesson:{' '}
                  {nextLesson.title} →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      '/lessons'
                    )
                  }
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/30 transition-all duration-200"
                >
                  🏆 View All Lessons
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  navigate(
                    '/lessons'
                  )
                }
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/12 text-slate-300 hover:bg-white/6 font-semibold text-sm transition-all duration-200"
              >
                ← Back to Lessons
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}