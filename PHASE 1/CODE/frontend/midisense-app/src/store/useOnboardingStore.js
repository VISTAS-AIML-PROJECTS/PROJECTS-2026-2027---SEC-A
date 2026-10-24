import { create } from 'zustand';

// ── Skill level calculation ─────────────────────────────────────────────────
// Each quiz question maps its answer to a point value (0, 1, or 2).
// Total score → Beginner (0-2) / Intermediate (3-5) / Advanced (6-8)
export function calculateSkillLevel(quizAnswers) {
  const total = Object.values(quizAnswers).reduce((sum, v) => sum + (v ?? 0), 0);
  if (total <= 2) return 'Beginner';
  if (total <= 5) return 'Intermediate';
  return 'Advanced';
}

const useOnboardingStore = create((set, get) => ({
  // Navigation
  step: 1,
  totalSteps: 7,

  // Step 2 — Instrument
  instrument: null,

  // User's main path
  mode: null, // 'learning' or 'production'

  // Step 3 — Goals
  goals: [],

  // Step 4 — Skill quiz
  quizAnswers: {}, // { q1: 0|1|2, q2: 0|1|2, ... }
  skillLevel: null, // computed after quiz step

  // Step 5 — Practice goal
  dailyGoalMinutes: 20,
  weeklyGoalDays: 5,

  // ── Actions ─────────────────────────────────────────────────────────────

  setStep: (step) => set({ step }),

  nextStep: () => set((s) => ({ step: Math.min(s.step + 1, s.totalSteps) })),
  prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),
  goToStep: (step) => set({ step }),

  setInstrument: (instrument) => set({ instrument }),
  setMode: (mode) => set({ mode }),
  toggleGoal: (goal) =>
    set((s) => ({
      goals: s.goals.includes(goal)
        ? s.goals.filter((g) => g !== goal)
        : [...s.goals, goal],
    })),

  setQuizAnswer: (questionId, value) =>
    set((s) => {
      const quizAnswers = { ...s.quizAnswers, [questionId]: value };
      const skillLevel  = calculateSkillLevel(quizAnswers);
      return { quizAnswers, skillLevel };
    }),

  setDailyGoalMinutes: (dailyGoalMinutes) => set({ dailyGoalMinutes }),
  setWeeklyGoalDays:   (weeklyGoalDays)   => set({ weeklyGoalDays }),

  reset: () =>
    set({
      step: 1,
      instrument: null,
      mode: null,
      goals: [],
      quizAnswers: {},
      skillLevel: null,
      dailyGoalMinutes: 20,
      weeklyGoalDays: 5,
    }),

  /** Serialise the full profile for Firestore. */
  getProfileSnapshot: () => {
    const s = get();
    return {
      instrument:        s.instrument,
      mode:              s.mode,
      goals:             s.goals,
      skillLevel:        s.skillLevel ?? calculateSkillLevel(s.quizAnswers),
      quizAnswers:       s.quizAnswers,
      dailyGoalMinutes:  s.dailyGoalMinutes,
      weeklyGoalDays:    s.weeklyGoalDays,
      onboardingComplete: true,
    };
  },
}));

export default useOnboardingStore;
