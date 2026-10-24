import Button from '../ui/Button';

const GOAL_LABELS = {
  hobby:   'Learn a new hobby',
  theory:  'Music theory',
  exams:   'Prepare for exams',
  compose: 'Write my own music',
  fun:     'Just for fun',
};

const QUIZ_LABELS = {
  q1: 'Sheet music',
  q2: 'Major scales',
  q3: 'Piano experience',
  q4: 'Music theory',
};

const QUIZ_OPTIONS = {
  q1: ['Not at all', 'A little', 'Fluently'],
  q2: ['No', 'Some of them', 'Most of them'],
  q3: ['Never', 'A few months', 'Years'],
  q4: ['None at all', 'Basics', 'Chords & harmony'],
};

const LEVEL_COLORS = {
  Beginner:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  Intermediate: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  Advanced:     'text-violet-400 bg-violet-500/10 border-violet-500/30',
};

function SectionCard({ title, children, onEdit, stepIndex }) {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(stepIndex)}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}

export default function StepSummary({
  mode,
  instrument,
  goals,
  quizAnswers,
  skillLevel,
  dailyGoalMinutes,
  weeklyGoalDays,
  onEdit,
  onFinish,
  saving,
}) {
  return (
    <div className="flex flex-col gap-5 step-animate">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-100">You're all set! 🎉</h2>
        <p className="text-slate-400 text-sm">
          Here's your profile summary. Edit anything before you start.
        </p>
      </div>

      {/* Selected Mode */}
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Your Path
          </h3>            <p className="text-slate-200 font-medium">
            {mode === 'learning' ? '🎓 Learning & Practice' : '🎛️ Music Production'}
          </p>
        </div>

      {/* Skill level badge */}
      {skillLevel && (
        <div className={`mx-auto flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${LEVEL_COLORS[skillLevel]}`}>
          <span>
            {skillLevel === 'Beginner' ? '🌱' : skillLevel === 'Intermediate' ? '🎯' : '🚀'}
          </span>
          {skillLevel}
        </div>
      )}

      {/* Instrument */}
      <SectionCard title="Instrument" onEdit={onEdit} stepIndex={2}>
        <p className="text-slate-200 font-medium capitalize">
          🎹 {instrument === 'piano' ? 'Piano / Keyboard' : instrument}
        </p>
      </SectionCard>

      {/* Goals */}
      <SectionCard title="Goals" onEdit={onEdit} stepIndex={3}>
        <div className="flex flex-wrap gap-1.5">
          {goals.map((g) => (
            <span
              key={g}
              className="text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-full"
            >
              {GOAL_LABELS[g] ?? g}
            </span>
          ))}
        </div>
      </SectionCard>

      {/* Quiz answers */}
      <SectionCard title="Skill Assessment" onEdit={onEdit} stepIndex={4}>
        <div className="space-y-1.5">
          {Object.entries(quizAnswers).map(([qId, ansIdx]) => (
            <div key={qId} className="flex justify-between text-sm">
              <span className="text-slate-400">{QUIZ_LABELS[qId]}</span>
              <span className="text-slate-200 font-medium">{QUIZ_OPTIONS[qId]?.[ansIdx] ?? ansIdx}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Practice goal */}
      <SectionCard title="Practice Goal" onEdit={onEdit} stepIndex={5}>
        <p className="text-slate-200 font-medium">
          {dailyGoalMinutes} min/day · {weeklyGoalDays} day{weeklyGoalDays > 1 ? 's' : ''}/week
        </p>
      </SectionCard>

      {/* Finish */}
      <Button
        variant="primary"
        onClick={onFinish}
        disabled={saving}
        className="w-full py-4 text-base mt-2"
      >
        {saving ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Saving…
          </>
        ) : (
          'Start Playing 🎹'
        )}
      </Button>
    </div>
  );
}
