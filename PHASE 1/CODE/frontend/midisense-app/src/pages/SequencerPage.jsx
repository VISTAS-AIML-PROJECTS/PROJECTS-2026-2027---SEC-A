/**
 * SequencerPage.jsx
 * -----------------
 * Main Sequencer page at /sequencer.
 *
 * Layout (flex column, fills 100dvh):
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Header            flex-shrink-0                             │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │  TransportBar      flex-shrink-0                             │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │  TrackList │ PianoRoll   flex-1 min-h-0 (fills all space)   │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │  PianoKeyboard     flex-shrink-0, fixed height              │
 *   └──────────────────────────────────────────────────────────────┘
 *   AiExplanationModal (fixed overlay)
 *
 * KEY LAYOUT NOTES:
 *   - Outer div: height 100dvh (not h-screen / 100vh which is unreliable)
 *   - Middle row: flex:'1 1 0' + minHeight:0  ← prevents flex-collapse bug
 *     Without minHeight:0 a flex child's min-height defaults to 'auto'
 *     (its content height), so the section overflows instead of shrinking.
 *   - TrackList / PianoRoll wrappers: same min-height:0 pattern.
 */

import { useCallback } from 'react';
import { useNavigate }    from 'react-router-dom';
import * as Tone          from 'tone';

import useAuthStore       from '../store/useAuthStore';
import useSequencerStore  from '../store/useSequencerStore';
import usePracticeStore   from '../store/usePracticeStore';
import { signOutUser }    from '../firebase/auth';

import useSequencerAudio  from '../audio/useSequencerAudio';

import TrackList          from '../components/sequencer/TrackList';
import TransportBar       from '../components/sequencer/TransportBar';
import PianoRoll          from '../components/sequencer/PianoRoll';
import AiExplanationModal from '../components/sequencer/AiExplanationModal';
import PianoKeyboard      from '../components/practice/PianoKeyboard';

export default function SequencerPage() {
  const navigate    = useNavigate();
  const user        = useAuthStore((s) => s.user);
  const clearUser   = useAuthStore((s) => s.clearUser);

  const selectedTrackId  = useSequencerStore((s) => s.selectedTrackId);
  const isRecording      = useSequencerStore((s) => s.isRecording);
  const snapEnabled      = useSequencerStore((s) => s.snapEnabled);
  const snapGrid         = useSequencerStore((s) => s.snapGrid);
  const quantizeOnRecord = useSequencerStore((s) => s.quantizeOnRecord);
  const addNote          = useSequencerStore((s) => s.addNote);

  const tempo = usePracticeStore((s) => s.tempo);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Musician';

  // ── Audio engine ──────────────────────────────────────────────────────────
  const { play, pause, stop, playheadBeats } = useSequencerAudio();

  // ── Sign out ──────────────────────────────────────────────────────────────
  async function handleSignOut() {
    await signOutUser();
    clearUser();
    navigate('/login', { replace: true });
  }

  // ── Record: intercept PianoKeyboard's onNoteOn ───────────────────────────
  const handleRecordNoteOn = useCallback((midiNote) => {
    if (!isRecording || !selectedTrackId) return;

    const transport      = Tone.getTransport();
    const beatsPerSecond = transport.bpm.value / 60;
    let startBeat        = transport.seconds * beatsPerSecond;

    if (quantizeOnRecord && snapEnabled) {
      const SNAP = { '1/4': 1, '1/8': 0.5, '1/16': 0.25 };
      const step  = SNAP[snapGrid] ?? 1;
      startBeat   = Math.round(startBeat / step) * step;
    }

    addNote(selectedTrackId, {
      pitch:         midiNote,
      startBeat:     Math.max(0, startBeat),
      durationBeats: 0.5,
    });
  }, [isRecording, selectedTrackId, addNote, quantizeOnRecord, snapEnabled, snapGrid]);

  // ── Transport play (sync BPM first) ──────────────────────────────────────
  const handlePlay = useCallback(async () => {
    Tone.getTransport().bpm.value = tempo;
    await play();
  }, [play, tempo]);

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100dvh',
        overflow:      'hidden',
        background:
          'radial-gradient(ellipse at 10% 0%, rgba(99,102,241,0.10) 0%, transparent 40%), ' +
          'radial-gradient(ellipse at 90% 100%, rgba(167,139,250,0.06) 0%, transparent 40%), ' +
          '#0b0b18',
      }}
    >
      {/* ── AI explanation modal (fixed, highest z) ── */}
      <AiExplanationModal />

      {/* ════════════════════════════════════════════
          HEADER — never shrinks
      ════════════════════════════════════════════ */}
      <header
        style={{ flexShrink: 0 }}
        className="flex items-center justify-between
                   px-4 sm:px-5 py-2.5
                   border-b border-white/8
                   bg-black/20 backdrop-blur-sm"
      >
        {/* Brand + page label */}
        <div className="flex items-center gap-3">
          <div
            role="link"
            tabIndex={0}
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate('/dashboard')}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard')}
            aria-label="Go to dashboard"
          >
            <span className="text-xl">🎹</span>
            <span className="font-bold text-slate-200 text-sm hidden sm:block">MIDISense</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-white/10" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
            Sequencer
          </span>
          <span className="hidden sm:block text-[10px] text-slate-600">· Piano Roll</span>
        </div>

        {/* Nav + user */}
        <div className="flex items-center gap-3">
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {[
              { label: 'Practice', path: '/practice' },
              { label: 'Lessons',  path: '/lessons'  },
            ].map(({ label, path }) => (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                className="text-xs text-slate-500 hover:text-slate-200
                           px-2.5 py-1.5 rounded-lg hover:bg-white/6
                           transition-all duration-150"
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="hidden sm:block w-px h-4 bg-white/10" />
          <span className="hidden md:block text-xs text-slate-500 max-w-[100px] truncate">
            {displayName}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs text-slate-400 hover:text-slate-200
                       border border-white/10 hover:border-white/20
                       px-2.5 py-1.5 rounded-lg transition-all"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ════════════════════════════════════════════
          TRANSPORT BAR — never shrinks
      ════════════════════════════════════════════ */}
      <div style={{ flexShrink: 0 }}>
        <TransportBar onPlay={handlePlay} onPause={pause} onStop={stop} />
      </div>

      {/* ════════════════════════════════════════════
          MAIN EDITING AREA
          flex: '1 1 0' + minHeight: 0
          ──────────────────────────────────────────
          The combination of flex:1 (grow) and minHeight:0 is the canonical
          fix for flex children not filling remaining height. Without
          minHeight:0 the browser uses 'auto' as the lower bound, which equals
          the child's intrinsic height — preventing shrinkage and causing the
          row to push the keyboard off-screen or collapse to zero.
      ════════════════════════════════════════════ */}
      <div
        style={{
          flex:      '1 1 0',
          minHeight: 0,
          display:   'flex',
          overflow:  'hidden',
        }}
      >
        {/* Track list — fixed width, scrolls vertically inside */}
        <div
          style={{
            flexShrink: 0,
            display:    'flex',
            flexDirection: 'column',
            height:     '100%',
          }}
        >
          <TrackList />
        </div>

        {/* Piano roll — fills all remaining width, handles its own scroll */}
        <div
          style={{
            flex:      '1 1 0',
            minWidth:  0,
            minHeight: 0,
            display:   'flex',
            flexDirection: 'column',
            overflow:  'hidden',
          }}
        >
          <PianoRoll playheadBeats={playheadBeats} />
        </div>
      </div>

      {/* ════════════════════════════════════════════
          PIANO KEYBOARD — never shrinks
          onNoteOn is only overridden when record is armed
          so normal key play still works in idle mode.
      ════════════════════════════════════════════ */}
      <div
        style={{ flexShrink: 0, background: 'rgba(0,0,0,0.30)' }}
        className="border-t border-white/8"
        aria-label="Piano keyboard — record input"
      >
        {isRecording && selectedTrackId && (
          <div className="flex items-center gap-2 px-4 py-1
                          border-b border-red-500/20 bg-red-500/10">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-[11px] font-semibold text-red-400">
              REC — play notes to record them into the selected track at the current playhead position
            </span>
          </div>
        )}
        <div className="px-3 py-2">
          <PianoKeyboard
            onNoteOn={isRecording && selectedTrackId ? handleRecordNoteOn : undefined}
          />
        </div>
      </div>
    </div>
  );
}
