// Scoring: each answer maps to 0 / 1 / 2 points.
// Total 0-8 → Beginner / Intermediate / Advanced (see useOnboardingStore)
const QUESTIONS = [
  {
    id: 'q1',
    question: 'Can you read sheet music?',
    options: ['Not at all', 'A little', 'Fluently'],
  },
  {
    id: 'q2',
    question: 'Do you know your major scales?',
    options: ['No', 'Some of them', 'Most of them'],
  },
  {
    id: 'q3',
    question: 'Have you played piano or keyboard before?',
    options: ['Never', 'A few months', 'Years'],
  },
  {
    id: 'q4',
    question: 'How familiar are you with music theory?',
    options: ['None at all', 'Basics (notes, rhythm)', 'Chords & harmony'],
  },
];

export default function StepSkillQuiz({ quizAnswers, onAnswer }) {
  const answered = Object.keys(quizAnswers).length;
  const total    = QUESTIONS.length;

  return (
    <div className="flex flex-col gap-6 step-animate">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-100">How's your skill level?</h2>
        <p className="text-slate-400 text-sm">
          Answer honestly — we'll tailor your experience accordingly.
        </p>
      </div>

      {/* Mini sub-progress */}
      <div className="flex gap-1.5 justify-center">
        {QUESTIONS.map((q, i) => (
          <div
            key={q.id}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              quizAnswers[q.id] !== undefined ? 'bg-indigo-500' : 'bg-white/12'
            }`}
          />
        ))}
      </div>

      <div className="flex flex-col gap-5">
        {QUESTIONS.map((q) => (
          <div key={q.id} className="glass-card p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-200">{q.question}</p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, idx) => {
                const isSelected = quizAnswers[q.id] === idx;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onAnswer(q.id, idx)}
                    className={`
                      w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium
                      border transition-all duration-150
                      ${isSelected
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                        : 'bg-white/4 border-white/8 text-slate-300 hover:bg-white/8 hover:border-white/16'
                      }
                    `}
                  >
                    <span className={`inline-block w-5 h-5 rounded-full border mr-3 text-center leading-4 text-xs
                      ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-white/20'}
                    `}>
                      {isSelected ? '✓' : ''}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-slate-500">
        {answered}/{total} answered{answered === total ? ' — great, you\'re done!' : ''}
      </p>
    </div>
  );
}
