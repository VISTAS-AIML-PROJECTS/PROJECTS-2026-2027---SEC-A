import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { saveUserProfile } from '../firebase/firestore';

const QUESTIONS = [
  {
    question: 'Which note is known as Middle C?',
    options: ['C3', 'C4', 'C5', 'D4'],
    answer: 'C4',
  },
  {
    question: 'How many letter names are used in the musical alphabet?',
    options: ['5', '6', '7', '8'],
    answer: '7',
  },
  {
    question: 'Which letters make up the musical alphabet?',
    options: ['A–F', 'A–G', 'A–H', 'C–G'],
    answer: 'A–G',
  },
  {
    question: 'What is the main purpose of good piano posture?',
    options: [
      'To play louder',
      'To prevent tension and make playing easier',
      'To increase tempo',
      'To use fewer fingers',
    ],
    answer: 'To prevent tension and make playing easier',
  },
  {
    question: 'How many fingers are numbered on each hand?',
    options: ['3', '4', '5', '10'],
    answer: '5',
  },

  {
    question: 'What visual landmark helps you find notes on a piano keyboard?',
    options: [
      'White-key length',
      'Groups of black keys',
      'Pedals',
      'Keyboard brand',
    ],
    answer: 'Groups of black keys',
  },
  {
    question: 'What does a sharp (#) do to a note?',
    options: [
      'Raises it by a semitone',
      'Lowers it by a semitone',
      'Makes it louder',
      'Makes it slower',
    ],
    answer: 'Raises it by a semitone',
  },
  {
    question: 'What does a flat (♭) do to a note?',
    options: [
      'Raises it by a semitone',
      'Lowers it by a semitone',
      'Makes it louder',
      'Doubles its duration',
    ],
    answer: 'Lowers it by a semitone',
  },
  {
    question: 'What are the black keys commonly associated with?',
    options: [
      'Sharps and flats',
      'Only white notes',
      'Only chords',
      'Only rhythms',
    ],
    answer: 'Sharps and flats',
  },
  {
    question: 'What is the beat in music?',
    options: [
      'A steady underlying pulse',
      'The loudest note',
      'A type of chord',
      'A piano pedal',
    ],
    answer: 'A steady underlying pulse',
  },

  {
    question: 'What does tempo control?',
    options: [
      'The pitch',
      'The speed of the music',
      'The number of keys',
      'The finger numbers',
    ],
    answer: 'The speed of the music',
  },
  {
    question: 'Why is keeping a steady pulse important?',
    options: [
      'It helps you play in time',
      'It changes the key',
      'It increases volume',
      'It removes black keys',
    ],
    answer: 'It helps you play in time',
  },
  {
    question: 'Which note duration is introduced as one of the fundamental note durations?',
    options: ['Quarter note', 'Whole rest', 'Sixteenth rest', 'Triplet'],
    answer: 'Quarter note',
  },
  {
    question: 'Which two note durations are taught in the beginner rhythm lessons?',
    options: [
      'Quarter and half notes',
      'Whole and eighth notes',
      'Sixteenth and thirty-second notes',
      'Triplets and rests',
    ],
    answer: 'Quarter and half notes',
  },

  {
    question: 'What is the purpose of a 5-finger position?',
    options: [
      'To practice smooth connected note sequences',
      'To play only chords',
      'To avoid using the thumb',
      'To play only black keys',
    ],
    answer: 'To practice smooth connected note sequences',
  },
  {
    question: 'Which melody is used in the beginner first-song lesson?',
    options: [
      'Twinkle Twinkle Little Star',
      'Mary Had a Little Lamb',
      'Happy Birthday',
      'Ode to Joy',
    ],
    answer: 'Mary Had a Little Lamb',
  },
  {
    question: 'What is the main challenge when playing with both hands?',
    options: [
      'Coordinating the left and right hands',
      'Finding the keyboard',
      'Changing the instrument',
      'Removing the pedals',
    ],
    answer: 'Coordinating the left and right hands',
  },

  {
    question: 'What is a chord?',
    options: [
      'Three or more notes played simultaneously',
      'One note played repeatedly',
      'A single musical letter',
      'A type of piano key',
    ],
    answer: 'Three or more notes played simultaneously',
  },
  {
    question: 'Which notes form a C major triad?',
    options: ['C–E–G', 'C–D–F', 'D–F–A', 'G–B–D'],
    answer: 'C–E–G',
  },
  {
    question: 'Which progression is taught using C major and G major?',
    options: ['I–V–I', 'I–IV–V', 'V–IV–I', 'I–I–V'],
    answer: 'I–V–I',
  },
];

export default function AssessmentPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const question = QUESTIONS[current];

  const selectAnswer = (answer) => {
    setAnswers((prev) => ({
      ...prev,
      [current]: answer,
    }));
  };

  const submitAssessment = async () => {
    let score = 0;

    QUESTIONS.forEach((q, index) => {
      if (answers[index] === q.answer) {
        score++;
      }
    });

    const passed = score >= 17;

    setResult({ score, passed });

    if (passed && user?.uid) {
      setSaving(true);

      try {
        await saveUserProfile(user.uid, {
          assessmentPassed: true,
        });
      } catch (err) {
        console.error('Assessment save error:', err);
      }

      setSaving(false);
    }
  };

  const retryAssessment = () => {
    setCurrent(0);
    setAnswers({});
    setResult(null);
  };

  if (result) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-slate-100 flex items-center justify-center p-6">
        <div className="glass-card max-w-lg w-full p-8 text-center space-y-6">
          <div className="text-6xl">
            {result.passed ? '🎉' : '📚'}
          </div>

          <h1 className="text-2xl font-bold">
            {result.passed ? 'Assessment Passed!' : 'Keep Practicing!'}
          </h1>

          <p className="text-slate-400">
            You scored
          </p>

          <div className="text-5xl font-bold text-indigo-400">
            {result.score}/20
          </div>

          <p className="text-slate-300">
            {result.passed
              ? 'Great job! You have demonstrated the basic knowledge needed for music production.'
              : 'You need at least 17 correct answers (85%) to pass. Review the lessons and try again.'}
          </p>

          {result.passed ? (
            <button
              type="button"
              onClick={() => navigate('/sequencer')}
              disabled={saving}
              className="w-full px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
            >
              {saving ? 'Saving...' : '🎛️ Start Music Production →'}
            </button>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={retryAssessment}
                className="w-full px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
              >
                🔄 Try Assessment Again
              </button>

              <button
                type="button"
                onClick={() => navigate('/lessons')}
                className="w-full px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold transition"
              >
                ← Review Lessons
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-slate-100 p-6">
      <main className="max-w-3xl mx-auto py-10">

        <div className="text-center mb-8">
          <p className="text-indigo-400 text-sm font-semibold uppercase tracking-wider">
            Beginner Assessment
          </p>

          <h1 className="text-3xl font-bold mt-2">
            Test Your Piano Knowledge
          </h1>

          <p className="text-slate-400 mt-2">
            Answer 20 questions. You need 85% or higher to pass.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>Question {current + 1} of 20</span>
            <span>{Math.round(((current + 1) / 20) * 100)}%</span>
          </div>

          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{
                width: `${((current + 1) / 20) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="glass-card p-6 sm:p-8">
          <h2 className="text-xl font-semibold mb-6">
            {question.question}
          </h2>

          <div className="grid gap-3">
            {question.options.map((option) => {
              const selected = answers[current] === option;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => selectAnswer(option)}
                  className={`
                    w-full text-left p-4 rounded-xl border transition
                    ${
                      selected
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300'
                    }
                  `}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={() => setCurrent((prev) => prev - 1)}
              disabled={current === 0}
              className="px-5 py-2.5 rounded-xl bg-white/5 text-slate-300 disabled:opacity-30"
            >
              ← Previous
            </button>

            {current < QUESTIONS.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrent((prev) => prev + 1)}
                disabled={!answers[current]}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-30"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={submitAssessment}
                disabled={!answers[current]}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-30"
              >
                Submit Assessment
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}