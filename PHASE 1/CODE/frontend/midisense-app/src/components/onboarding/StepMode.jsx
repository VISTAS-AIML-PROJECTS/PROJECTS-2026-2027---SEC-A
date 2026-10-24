export default function StepMode({ mode, onSelect }) {
  return (
    <div className="flex flex-col gap-8 step-animate">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-100">
          What do you want to do?
        </h2>
        <p className="text-slate-400 text-sm">
          Choose how you want to use MIDISense.
        </p>
      </div>

      <div className="grid gap-4">
        {/* Learning */}
        <button
          type="button"
          onClick={() => onSelect('learning')}
          className={`
            p-6 rounded-2xl border text-left transition-all
            ${mode === 'learning'
              ? 'border-indigo-500 bg-indigo-600/20 shadow-lg shadow-indigo-500/20'
              : 'border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20'
            }
          `}
        >
          <div className="text-3xl mb-3">🎓</div>
          <h3 className="text-lg font-bold text-slate-100">
            Learning & Practice
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Learn piano, practice exercises, improve your timing and
            get feedback from your AI tutor.
          </p>
        </button>

        {/* Music Production */}
        <button
          type="button"
          onClick={() => onSelect('production')}
          className={`
            p-6 rounded-2xl border text-left transition-all
            ${mode === 'production'
              ? 'border-violet-500 bg-violet-600/20 shadow-lg shadow-violet-500/20'
              : 'border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20'
            }
          `}
        >
          <div className="text-3xl mb-3">🎛️</div>
          <h3 className="text-lg font-bold text-slate-100">
            Music Production
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Create music using the sequencer, instruments, recording
            and arranging tools.
          </p>
        </button>
      </div>
    </div>
  );
}