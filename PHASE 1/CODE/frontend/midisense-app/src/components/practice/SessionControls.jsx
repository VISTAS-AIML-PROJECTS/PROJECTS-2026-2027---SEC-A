/**
 * SessionControls.jsx
 * -------------------
 * Top-left panel: Recording toggle, Metronome toggle, and Tempo ± controls.
 */

import usePracticeStore from '../../store/usePracticeStore';

export default function SessionControls() {
  const isRecording    = usePracticeStore((s) => s.isRecording);
  const toggleRecording = usePracticeStore((s) => s.toggleRecording);
  const metronomeOn    = usePracticeStore((s) => s.metronomeOn);
  const toggleMetronome = usePracticeStore((s) => s.toggleMetronome);
  const tempo          = usePracticeStore((s) => s.tempo);
  const incrementTempo  = usePracticeStore((s) => s.incrementTempo);
  const decrementTempo  = usePracticeStore((s) => s.decrementTempo);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* ── Recording toggle ── */}
      <button
        id="btn-recording-toggle"
        type="button"
        onClick={toggleRecording}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
          border transition-all duration-200 select-none
          ${isRecording
            ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
            : 'bg-white/6 border-white/12 text-slate-300 hover:bg-white/10 hover:text-slate-100'
          }
        `}
        aria-pressed={isRecording}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {/* Animated red dot when recording */}
        <span
          className={`
            w-2.5 h-2.5 rounded-full flex-shrink-0
            ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}
          `}
        />
        {isRecording ? 'Recording…' : 'Start Recording'}
      </button>

      {/* ── Metronome toggle ── */}
      <button
        id="btn-metronome-toggle"
        type="button"
        onClick={toggleMetronome}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
          border transition-all duration-200 select-none
          ${metronomeOn
            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/30'
            : 'bg-white/6 border-white/12 text-slate-300 hover:bg-white/10 hover:text-slate-100'
          }
        `}
        aria-pressed={metronomeOn}
        aria-label={metronomeOn ? 'Turn metronome off' : 'Turn metronome on'}
      >
        {/* Simple metronome icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`w-4 h-4 ${metronomeOn ? 'animate-[swing_0.6s_ease-in-out_infinite_alternate]' : ''}`}
        >
          <path d="M12 2L6 20h12L12 2zm0 3.5l4.5 13H7.5L12 5.5z" />
        </svg>
        Metronome {metronomeOn ? 'ON' : 'OFF'}
      </button>

      {/* ── Tempo control ── */}
      <div
        className="flex items-center gap-1 bg-white/6 border border-white/12 rounded-xl overflow-hidden"
        aria-label="Tempo control"
      >
        <button
          id="btn-tempo-decrement"
          type="button"
          onClick={decrementTempo}
          className="px-3 py-2 text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors duration-150 font-bold text-base leading-none"
          aria-label="Decrease tempo"
        >
          −
        </button>
        <div className="px-3 py-2 text-center min-w-[80px]">
          <span className="text-sm font-bold text-indigo-300">{tempo}</span>
          <span className="text-xs text-slate-500 ml-1">BPM</span>
        </div>
        <button
          id="btn-tempo-increment"
          type="button"
          onClick={incrementTempo}
          className="px-3 py-2 text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors duration-150 font-bold text-base leading-none"
          aria-label="Increase tempo"
        >
          +
        </button>
      </div>
    </div>
  );
}
