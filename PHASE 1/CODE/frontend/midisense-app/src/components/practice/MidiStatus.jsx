/**
 * MidiStatus.jsx
 * --------------
 * Top-right MIDI connection status pill.
 *
 * DEV NOTE: The midiConnected state is currently toggled by a hidden dev button
 * (visible only in development mode, or via the keyboard shortcut Ctrl+M).
 * When real Web MIDI is implemented, replace the Zustand toggle with:
 *   navigator.requestMIDIAccess().then(access => {
 *     access.onstatechange = (e) => setMidiConnected(e.port.state === 'connected');
 *   });
 * The status pill UI here needs no changes — just hook up the store action.
 */

import { useEffect } from 'react';
import usePracticeStore from '../../store/usePracticeStore';

export default function MidiStatus() {
  const midiConnected   = usePracticeStore((s) => s.midiConnected);
  const toggleMidi      = usePracticeStore((s) => s.toggleMidiConnected);

  // ── Dev keyboard shortcut: Ctrl+M to toggle MIDI status for testing ────────
  // TODO: Remove this entire useEffect when real Web MIDI API is integrated.
  useEffect(() => {
    function handleKey(e) {
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        toggleMidi();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleMidi]);

  return (
    <div className="flex items-center gap-2">
      {/* Status pill */}
      <div
        id="midi-status-pill"
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
          border transition-all duration-300
          ${midiConnected
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
            : 'bg-slate-500/15 border-slate-500/40 text-slate-400'
          }
        `}
        role="status"
        aria-label={midiConnected ? 'MIDI device connected' : 'No MIDI device'}
        aria-live="polite"
      >
        <span
          className={`
            w-2 h-2 rounded-full flex-shrink-0
            ${midiConnected ? 'bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]' : 'bg-slate-500'}
          `}
        />
        {midiConnected ? 'MIDI Connected' : 'No MIDI Device'}
      </div>

      {/* ── DEV-ONLY toggle button ──────────────────────────────────────────
          This button is a PLACEHOLDER for real Web MIDI device detection.
          It exists solely for visual testing. Remove when integrating Web MIDI.
          Also accessible via keyboard shortcut: Ctrl+M
      ─────────────────────────────────────────────────────────────────────── */}
      <button
        id="btn-midi-dev-toggle"
        type="button"
        onClick={toggleMidi}
        className="text-[10px] px-2 py-1 rounded-md bg-white/4 border border-white/8 text-slate-600 hover:text-slate-400 hover:bg-white/8 transition-all duration-150"
        title="[DEV] Toggle MIDI connection status (Ctrl+M)"
        aria-label="Developer toggle for MIDI connection simulation"
      >
        DEV
      </button>
    </div>
  );
}
