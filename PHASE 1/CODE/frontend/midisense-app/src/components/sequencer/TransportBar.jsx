/**
 * TransportBar.jsx
 * ----------------
 * Top strip of the Sequencer with playback controls, record, snap, loop,
 * AI buttons, Export MIDI, and Save/Load.
 */

import useSequencerStore, { SNAP_VALUES } from '../../store/useSequencerStore';
import usePracticeStore  from '../../store/usePracticeStore';
import useAuthStore      from '../../store/useAuthStore';
import { saveProject, loadProject } from '../../firebase/sequencerService';
import { exportMidi } from '../../utils/exportMidi';

// ── Icons ─────────────────────────────────────────────────────────────────────

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M8 5v14l11-7z"/>
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
  </svg>
);
const StopIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M6 6h12v12H6z"/>
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────

export default function TransportBar({ onPlay, onPause, onStop }) {
  const user = useAuthStore((s) => s.user);

  const isPlaying      = useSequencerStore((s) => s.isPlaying);
  const isRecording    = useSequencerStore((s) => s.isRecording);
  const setRecording   = useSequencerStore((s) => s.setRecording);
  const loopEnabled    = useSequencerStore((s) => s.loopEnabled);
  const toggleLoop     = useSequencerStore((s) => s.toggleLoop);
  const snapGrid       = useSequencerStore((s) => s.snapGrid);
  const snapEnabled    = useSequencerStore((s) => s.snapEnabled);
  const setSnapGrid    = useSequencerStore((s) => s.setSnapGrid);
  const toggleSnap     = useSequencerStore((s) => s.toggleSnap);

  const tracks         = useSequencerStore((s) => s.tracks);
  const totalBars      = useSequencerStore((s) => s.totalBars);
  const loadProjectState = useSequencerStore((s) => s.loadProject);
  const doSuggestBassline = useSequencerStore((s) => s.suggestBassline);
  const doSuggestChords   = useSequencerStore((s) => s.suggestChords);
  const selectedTrackId   = useSequencerStore((s) => s.selectedTrackId);
  const quantizeNotes     = useSequencerStore((s) => s.quantizeNotes);
  const loopStart         = useSequencerStore((s) => s.loopStart);
  const loopEnd           = useSequencerStore((s) => s.loopEnd);
  const tempo             = usePracticeStore((s) => s.tempo);
  const setTempo          = usePracticeStore((s) => s.setTempo);

  const hasSelectedNotes = tracks.find((t) => t.id === selectedTrackId)?.notes?.length > 0;

  // ── Save / Load ───────────────────────────────────────────────────────────

  async function handleSave() {
    if (!user) return;
    try {
      await saveProject(user.uid, {
        tracks, tempo, totalBars,
        loopEnabled, loopStart, loopEnd,
      });
      // Brief visual feedback via title flash (no toast system on this page)
      const btn = document.getElementById('btn-seq-save');
      if (btn) {
        btn.textContent = '✓ Saved';
        setTimeout(() => { if (btn) btn.textContent = '💾 Save'; }, 1500);
      }
    } catch (err) {
      console.error('Sequencer save failed:', err);
    }
  }

  async function handleLoad() {
    if (!user) return;
    try {
      const project = await loadProject(user.uid);
      loadProjectState(project);
      // Restore BPM into PracticeStore so Transport syncs
      if (typeof project.tempo === 'number') {
        setTempo(project.tempo);
      }
    } catch (err) {
      console.error('Sequencer load failed:', err);
    }
  }

  // ── Export MIDI ───────────────────────────────────────────────────────────

  function handleExportMidi() {
    exportMidi(tracks, tempo, 'MIDISense-Project.mid');
  }

  // ── Shared button class helpers ───────────────────────────────────────────

  const baseBtn = `
    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
    border transition-all duration-150 select-none
  `;
  const ghost = `${baseBtn} bg-white/6 border-white/12 text-slate-300 hover:bg-white/10 hover:text-slate-100`;
  const active = (on) => on
    ? `${baseBtn} bg-indigo-500/20 border-indigo-500/50 text-indigo-300`
    : ghost;

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-2
                 border-b border-white/8 bg-[#0e0e1c]/80 backdrop-blur-sm"
      aria-label="Transport controls"
    >
      {/* ── Playback ── */}
      <div className="flex items-center gap-1">
        {/* Stop */}
        <button type="button" id="btn-seq-stop"
          onClick={onStop}
          disabled={!isPlaying && !isRecording}
          aria-label="Stop"
          className={`${baseBtn} ${
            !isPlaying && !isRecording
              ? 'opacity-40 cursor-not-allowed bg-white/4 border-white/8 text-slate-600'
              : 'bg-white/6 border-white/12 text-slate-300 hover:bg-white/10 hover:text-slate-100'
          }`}
        >
          <StopIcon />
        </button>

        {/* Play / Pause */}
        <button type="button" id="btn-seq-play"
          onClick={isPlaying ? onPause : onPlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={`${baseBtn} ${
            isPlaying
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
              : 'bg-white/6 border-white/12 text-slate-300 hover:bg-white/10 hover:text-slate-100'
          }`}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        {/* Record */}
        <button type="button" id="btn-seq-record"
          onClick={() => setRecording(!isRecording)}
          disabled={!selectedTrackId}
          aria-pressed={isRecording}
          aria-label={isRecording ? 'Stop recording' : 'Arm recording'}
          className={`${baseBtn} ${
            !selectedTrackId
              ? 'opacity-40 cursor-not-allowed bg-white/4 border-white/8 text-slate-600'
              : isRecording
                ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
                : 'bg-white/6 border-white/12 text-slate-300 hover:bg-white/10 hover:text-slate-100'
          }`}
        >
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-600'
          }`} />
          {isRecording ? 'Rec…' : 'Record'}
        </button>
      </div>

      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* ── BPM control (editable, syncs to PracticeStore) ── */}
      <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                      bg-white/4 border border-white/10">
        <input
          type="number"
          id="input-seq-bpm"
          min={20}
          max={300}
          value={tempo}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isNaN(v)) setTempo(v);
          }}
          aria-label="Tempo BPM"
          className="w-10 bg-transparent text-xs font-bold text-indigo-300
                     text-center focus:outline-none
                     [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                     [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-[10px] text-slate-600">BPM</span>
      </div>

      {/* ── Loop toggle ── */}
      <button type="button" id="btn-seq-loop"
        onClick={toggleLoop}
        aria-pressed={loopEnabled}
        aria-label={loopEnabled ? 'Disable loop' : 'Enable loop'}
        className={active(loopEnabled)}
      >
        🔁 Loop
      </button>

      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* ── Snap controls ── */}
      <div className="flex items-center gap-1">
        <button type="button" id="btn-seq-snap"
          onClick={toggleSnap}
          aria-pressed={snapEnabled}
          aria-label={snapEnabled ? 'Disable snap' : 'Enable snap'}
          className={active(snapEnabled)}
        >
          🧲 Snap
        </button>

        {snapEnabled && (
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {Object.keys(SNAP_VALUES).map((grid) => (
              <button
                key={grid}
                type="button"
                onClick={() => setSnapGrid(grid)}
                className={`px-2.5 py-1.5 text-[10px] font-bold transition-colors duration-100 ${
                  snapGrid === grid
                    ? 'bg-indigo-500/30 text-indigo-300'
                    : 'bg-white/5 text-slate-500 hover:text-slate-300'
                }`}
              >
                {grid}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Quantize (applies to existing notes on selected track) ── */}
      <button type="button" id="btn-seq-quantize"
        onClick={quantizeNotes}
        disabled={!hasSelectedNotes}
        title={hasSelectedNotes ? `Quantize notes on selected track to ${snapGrid} grid` : 'Select a track with notes first'}
        className={`${baseBtn} ${
          hasSelectedNotes
            ? 'bg-white/6 border-white/12 text-slate-300 hover:bg-white/10 hover:text-slate-100'
            : 'opacity-40 cursor-not-allowed bg-white/4 border-white/8 text-slate-600'
        }`}
      >
        ↗ Quantize
      </button>

      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* ── AI buttons ── */}
      <button type="button" id="btn-ai-bassline"
        onClick={doSuggestBassline}
        disabled={!hasSelectedNotes}
        title={hasSelectedNotes ? 'Generate AI bassline from selected track' : 'Select a track with notes first'}
        className={`${baseBtn} ${
          hasSelectedNotes
            ? 'bg-violet-500/15 border-violet-500/35 text-violet-300 hover:bg-violet-500/25'
            : 'opacity-40 cursor-not-allowed bg-white/4 border-white/8 text-slate-600'
        }`}
      >
        ✨ Bassline
      </button>

      <button type="button" id="btn-ai-chords"
        onClick={doSuggestChords}
        disabled={!hasSelectedNotes}
        title={hasSelectedNotes ? 'Generate AI chords from selected track' : 'Select a track with notes first'}
        className={`${baseBtn} ${
          hasSelectedNotes
            ? 'bg-violet-500/15 border-violet-500/35 text-violet-300 hover:bg-violet-500/25'
            : 'opacity-40 cursor-not-allowed bg-white/4 border-white/8 text-slate-600'
        }`}
      >
        🎵 Chords
      </button>

      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* ── Save / Load ── */}
      <button type="button" id="btn-seq-save"
        onClick={handleSave}
        disabled={!user}
        className={`${baseBtn} ${
          !user
            ? 'opacity-40 cursor-not-allowed bg-white/4 border-white/8 text-slate-600'
            : 'bg-white/6 border-white/12 text-slate-300 hover:bg-white/10 hover:text-slate-100'
        }`}
        aria-label="Save project to cloud"
      >
        💾 Save
      </button>

      <button type="button" id="btn-seq-load"
        onClick={handleLoad}
        disabled={!user}
        className={`${baseBtn} ${
          !user
            ? 'opacity-40 cursor-not-allowed bg-white/4 border-white/8 text-slate-600'
            : 'bg-white/6 border-white/12 text-slate-300 hover:bg-white/10 hover:text-slate-100'
        }`}
        aria-label="Load project from cloud"
      >
        📂 Load
      </button>

      {/* ── Export MIDI ── */}
      <button type="button" id="btn-seq-export"
        onClick={handleExportMidi}
        disabled={!tracks.some((t) => t.notes.length > 0)}
        className={`${baseBtn} ${
          tracks.some((t) => t.notes.length > 0)
            ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
            : 'opacity-40 cursor-not-allowed bg-white/4 border-white/8 text-slate-600'
        }`}
        aria-label="Export project as MIDI file"
      >
        ⬇ Export MIDI
      </button>
    </div>
  );
}
