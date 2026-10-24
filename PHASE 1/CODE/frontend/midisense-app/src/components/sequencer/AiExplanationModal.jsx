/**
 * AiExplanationModal.jsx
 * ----------------------
 * Simple popup that appears after an AI suggestion (bassline / chords)
 * with a plain-text explanation of what was generated.
 */

import useSequencerStore from '../../store/useSequencerStore';

export default function AiExplanationModal() {
  const aiModal    = useSequencerStore((s) => s.aiModal);
  const closeModal = useSequencerStore((s) => s.closeAiModal);

  if (!aiModal) return null;

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={closeModal}
    >
      {/* Panel — stop propagation so clicking inside doesn't dismiss */}
      <div
        className="glass-card max-w-md w-full p-6 space-y-4 relative"
        style={{
          background:  'rgba(22,22,46,0.95)',
          borderColor: 'rgba(129,140,248,0.25)',
          animation:   'aiModalIn 220ms cubic-bezier(0.16,1,0.3,1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sparkle icon + title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30
                          flex items-center justify-center text-xl flex-shrink-0">
            ✨
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
              AI Accompaniment
            </p>
            <h2 id="ai-modal-title" className="text-base font-bold text-slate-100">
              {aiModal.title}
            </h2>
          </div>
        </div>

        {/* Explanation text */}
        <p className="text-sm text-slate-300 leading-relaxed">
          {aiModal.message}
        </p>

        {/* Info note */}
        <p className="text-[11px] text-slate-600 leading-relaxed border-t border-white/6 pt-3">
          Note generation is rule-based (music theory), not free-form AI, 
          ensuring precise, in-key results every time.
        </p>

        {/* Dismiss */}
        <button
          type="button"
          id="btn-ai-modal-close"
          onClick={closeModal}
          className="w-full py-2 rounded-xl text-sm font-semibold
                     bg-indigo-500/20 hover:bg-indigo-500/30 
                     border border-indigo-500/40 text-indigo-300
                     transition-all duration-200"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
