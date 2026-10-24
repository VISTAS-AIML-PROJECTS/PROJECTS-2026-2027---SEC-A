import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useOnboardingStore from '../store/useOnboardingStore';
import useAuthStore from '../store/useAuthStore';
import { saveUserProfile } from '../firebase/firestore';

import ProgressBar        from '../components/ui/ProgressBar';
import Button             from '../components/ui/Button';
import StepWelcome        from '../components/onboarding/StepWelcome';
import StepInstrument     from '../components/onboarding/StepInstrument';
import StepGoals          from '../components/onboarding/StepGoals';
import StepSkillQuiz      from '../components/onboarding/StepSkillQuiz';
import StepPracticeGoal   from '../components/onboarding/StepPracticeGoal';
import StepMode           from '../components/onboarding/StepMode';
import StepSummary        from '../components/onboarding/StepSummary';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const user     = useAuthStore((s) => s.user);

  const {
    step, totalSteps,
    mode, instrument, goals, quizAnswers, skillLevel, dailyGoalMinutes, weeklyGoalDays,
    nextStep, prevStep, goToStep,
    setInstrument, setMode,toggleGoal, setQuizAnswer,
    setDailyGoalMinutes, setWeeklyGoalDays,
    getProfileSnapshot, reset,
  } = useOnboardingStore();

  const [saving, setSaving] = useState(false);

  // ── Step validation ──────────────────────────────────────────────────────
  function canAdvance() {
    if (step === 1) return true;
    if (step === 2) return Boolean(instrument);
    if (step === 3) return goals.length > 0;
    if (step === 4) return Object.keys(quizAnswers).length >= 4;
    if (step === 5) return Boolean(dailyGoalMinutes) && Boolean(weeklyGoalDays);
    if (step === 6) return Boolean(mode);
    return true;
  }

  // ── Finish: save to Firestore ────────────────────────────────────────────
  async function handleFinish() {
    if (!user) return;
    setSaving(true);
    try {
      const profile = getProfileSnapshot();
      await saveUserProfile(user.uid, {
        ...profile,
        displayName: user.displayName ?? '',
        email:       user.email ?? '',
        updatedAt:   new Date().toISOString(),
      });
      reset();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Failed to save profile:', err);
      setSaving(false);
    }
  }

  // ── Step components map ──────────────────────────────────────────────────
  const STEPS = {
    1: <StepWelcome      onNext={nextStep} />,
    2: <StepInstrument   instrument={instrument}     onSelect={setInstrument} />,
    3: <StepGoals        goals={goals}               onToggle={toggleGoal} />,
    4: <StepSkillQuiz    quizAnswers={quizAnswers}   onAnswer={setQuizAnswer} />,
    5: <StepPracticeGoal
          dailyGoalMinutes={dailyGoalMinutes}
          weeklyGoalDays={weeklyGoalDays}
          onDailyChange={setDailyGoalMinutes}
          onWeeklyChange={setWeeklyGoalDays}
      />,
    6: <StepMode
      mode={mode}
      onSelect={setMode}
  />,
    7: <StepSummary
          mode={mode}
          instrument={instrument}
          goals={goals}
          quizAnswers={quizAnswers}
          skillLevel={skillLevel}
          dailyGoalMinutes={dailyGoalMinutes}
          weeklyGoalDays={weeklyGoalDays}
          onEdit={goToStep}
          onFinish={handleFinish}
          saving={saving}
      />,
  };

  const isFirstStep = step === 1;
  const isLastStep  = step === totalSteps;
  const showNav     = step > 1 && step < totalSteps; // steps 2-5 show Back/Next

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8"
        style={{ background: 'radial-gradient(ellipse at 40% 0%, rgba(99,102,241,0.15) 0%, transparent 55%), #0f0f1a' }}>

      {/* ── Header ── */}
      <div className="w-full max-w-lg space-y-6">
        {/* Logo row */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎹</span>
          <span className="font-bold text-slate-200 text-lg">MIDISense</span>
        </div>

        {/* Progress bar (hidden on welcome) */}
        {step > 1 && (
          <ProgressBar current={step} total={totalSteps} />
        )}
      </div>

      {/* ── Step content ── */}
      <div className="w-full max-w-lg mt-8 flex-1">
        <div key={step} className="step-animate">
          {STEPS[step]}
        </div>
      </div>

      {/* ── Navigation: Back / Next (steps 2-5) ── */}
      {showNav && (
        <div className="w-full max-w-lg mt-8 flex gap-3">
          <Button variant="secondary" onClick={prevStep} className="flex-1">
            ← Back
          </Button>
          <Button
            variant="primary"
            onClick={nextStep}
            disabled={!canAdvance()}
            className="flex-1"
          >
            {step === totalSteps - 1 ? 'Review →' : 'Next →'}
          </Button>
        </div>
      )}
    </div>
  );
}
