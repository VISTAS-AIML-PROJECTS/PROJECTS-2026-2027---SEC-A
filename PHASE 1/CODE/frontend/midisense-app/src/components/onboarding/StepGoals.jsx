import SelectionCard from '../ui/SelectionCard';

const GOALS = [
  { id: 'hobby',   label: 'Learn a new hobby',         icon: '🌱', description: 'Pick up music for the first time' },
  { id: 'theory',  label: 'Music theory',               icon: '📚', description: 'Understand chords, scales & harmony' },
  { id: 'exams',   label: 'Prepare for exams',          icon: '🎓', description: 'Grade exams or recitals' },
  { id: 'compose', label: 'Write my own music',         icon: '✍️',  description: 'Compose and produce original tracks' },
  { id: 'fun',     label: 'Just for fun',               icon: '🎉', description: 'No pressure, just enjoy playing' },
];

export default function StepGoals({ goals, onToggle }) {
  return (
    <div className="flex flex-col gap-6 step-animate">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-100">What are your goals?</h2>
        <p className="text-slate-400 text-sm">
          Choose everything that resonates — pick as many as you like.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {GOALS.map((goal) => (
          <SelectionCard
            key={goal.id}
            label={goal.label}
            description={goal.description}
            icon={goal.icon}
            selected={goals.includes(goal.id)}
            onClick={() => onToggle(goal.id)}
            className="flex-row justify-start gap-4 text-left"
          />
        ))}
      </div>

      {goals.length === 0 && (
        <p className="text-center text-xs text-slate-500">
          Pick at least one goal to continue
        </p>
      )}
    </div>
  );
}
