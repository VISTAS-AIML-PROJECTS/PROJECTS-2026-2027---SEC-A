/**
 * PianoRoll.jsx
 * -------------
 * Canvas-based piano-roll editor for the Sequencer.
 *
 * Layout (within the scrollable container):
 *   [keyboard strip ~44px] | [grid + notes area, scrolls horizontally]
 *   The whole panel scrolls vertically (pitch axis).
 *
 * Interactions:
 *   Left-click  empty cell  → draw new note (drag to set duration)
 *   Left-click  note body   → drag to move note
 *   Left-click  right edge  → drag to resize note duration
 *   Right-click note        → delete note
 *   Shift+drag  empty area  → set loop region
 *
 * Grid:
 *   - Horizontal lines per semitone (24px each)
 *   - Vertical beat/bar lines (beat width depends on zoom)
 *   - Black-key rows tinted slightly darker
 *
 * Playhead:
 *   A vertical line at playheadBeats received from useSequencerAudio
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import useSequencerStore, { snapBeat, SNAP_VALUES } from '../../store/useSequencerStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROW_HEIGHT    = 14;   // px per semitone row
const KEY_WIDTH     = 44;   // px for the mini keyboard strip
const BEAT_WIDTH    = 48;   // px per quarter-note beat at default zoom
const MIN_DUR_BEATS = 0.25; // minimum note duration (1/16th note)

const NOTE_NAMES   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const BLACK_SET    = new Set([1,3,6,8,10]);

// MIDI range to display (C2 = 36 to B6 = 95)
const MIDI_MIN = 24;   // C1 — low enough for bass
const MIDI_MAX = 96;   // C7 — high enough for melody
const MIDI_RANGE = MIDI_MAX - MIDI_MIN; // number of rows

// ── Helpers ───────────────────────────────────────────────────────────────────

function midiToY(midi) {
  // Top of canvas = highest pitch (MIDI_MAX); bottom = lowest (MIDI_MIN)
  return (MIDI_MAX - midi) * ROW_HEIGHT;
}

function yToMidi(y) {
  return MIDI_MAX - Math.floor(y / ROW_HEIGHT);
}

function beatToX(beat) {
  return beat * BEAT_WIDTH;
}

function xToBeat(x) {
  return x / BEAT_WIDTH;
}

function isBlackKey(midi) {
  return BLACK_SET.has(midi % 12);
}

function noteLabel(midi) {
  const pc     = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return NOTE_NAMES[pc] + (pc === 0 ? octave : '');
}

// ── PianoRoll ─────────────────────────────────────────────────────────────────

export default function PianoRoll({ playheadBeats = 0 }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);

  const tracks          = useSequencerStore((s) => s.tracks);
  const selectedTrackId = useSequencerStore((s) => s.selectedTrackId);
  const snapEnabled     = useSequencerStore((s) => s.snapEnabled);
  const snapGrid        = useSequencerStore((s) => s.snapGrid);
  const totalBars       = useSequencerStore((s) => s.totalBars);
  const loopStart       = useSequencerStore((s) => s.loopStart);
  const loopEnd         = useSequencerStore((s) => s.loopEnd);
  const loopEnabled     = useSequencerStore((s) => s.loopEnabled);
  const setLoop         = useSequencerStore((s) => s.setLoop);
  const addNote         = useSequencerStore((s) => s.addNote);
  const updateNote      = useSequencerStore((s) => s.updateNote);
  const deleteNote      = useSequencerStore((s) => s.deleteNote);

  // Total canvas dimensions
  const totalBeats = totalBars * 4;
  const canvasW    = KEY_WIDTH + totalBeats * BEAT_WIDTH;
  const canvasH    = MIDI_RANGE * ROW_HEIGHT;

  // Drag state
  const drag = useRef(null);
  // { mode: 'draw'|'move'|'resize'|'loop',
  //   trackId, noteId, startX, startY,
  //   origNote, origBeat, origPitch }

  // ── Drawing ───────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);

    const scrollLeft = containerRef.current?.scrollLeft ?? 0;
    const scrollTop  = containerRef.current?.scrollTop  ?? 0;

    // ── Background rows ────────────────────────────────────────────────────
    for (let midi = MIDI_MIN; midi < MIDI_MAX; midi++) {
      const y   = midiToY(midi);
      const blk = isBlackKey(midi);
      ctx.fillStyle = blk ? '#0d0d1f' : '#13132a';
      ctx.fillRect(0, y, canvasW, ROW_HEIGHT);

      // Subtle row separator
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(KEY_WIDTH, y + ROW_HEIGHT - 1, canvasW - KEY_WIDTH, 1);
    }

    // ── Loop region ────────────────────────────────────────────────────────
    if (loopEnabled) {
      ctx.fillStyle = 'rgba(99,102,241,0.08)';
      ctx.fillRect(
        KEY_WIDTH + beatToX(loopStart), 0,
        beatToX(loopEnd - loopStart), canvasH,
      );
      // Loop boundary lines
      ctx.strokeStyle = 'rgba(99,102,241,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(KEY_WIDTH + beatToX(loopStart), 0);
      ctx.lineTo(KEY_WIDTH + beatToX(loopStart), canvasH);
      ctx.moveTo(KEY_WIDTH + beatToX(loopEnd), 0);
      ctx.lineTo(KEY_WIDTH + beatToX(loopEnd), canvasH);
      ctx.stroke();
    }

    // ── Vertical grid lines ────────────────────────────────────────────────
    const snapStep = SNAP_VALUES[snapGrid] ?? 1;
    for (let beat = 0; beat <= totalBeats; beat += snapStep) {
      const x       = KEY_WIDTH + beatToX(beat);
      const isBar   = Number.isInteger(beat / 4);
      const isBeat  = Number.isInteger(beat);

      if (isBar) {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth   = 1.5;
      } else if (isBeat) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth   = 1;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth   = 1;
      }

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasH);
      ctx.stroke();

      // Bar number label
      if (isBar) {
        const barNum = beat / 4 + 1;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font      = '10px Inter, sans-serif';
        ctx.fillText(`${barNum}`, x + 3, scrollTop + 12);
      }
    }

    // ── Note blocks ───────────────────────────────────────────────────────
    const hasSolo = tracks.some((t) => t.soloed);
    for (const track of tracks) {
      const silenced = track.muted || (hasSolo && !track.soloed);
      for (const note of track.notes) {
        const x  = KEY_WIDTH + beatToX(note.startBeat);
        const y  = midiToY(note.pitch);
        const w  = Math.max(2, beatToX(note.durationBeats) - 1);
        const h  = ROW_HEIGHT - 1;

        // Fill
        const alpha = silenced ? 0.25 : 1;
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = track.color;
        ctx.beginPath();
        ctx.roundRect(x, y + 1, w, h - 2, 3);
        ctx.fill();

        // Inner highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + 1, y + 2, Math.min(w - 2, 20), 2);

        // Label (if wide enough)
        if (w > 20) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font      = `bold 9px Inter, sans-serif`;
          ctx.fillText(noteLabel(note.pitch), x + 4, y + h - 3);
        }

        // Resize handle zone (right 8px)
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x + w - 4, y + 3, 3, h - 6);

        ctx.globalAlpha = 1;
      }
    }

    // ── Playhead ──────────────────────────────────────────────────────────
    if (playheadBeats > 0 || true) {
      const px = KEY_WIDTH + beatToX(playheadBeats);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, scrollTop);
      ctx.lineTo(px, scrollTop + (containerRef.current?.clientHeight ?? canvasH));
      ctx.stroke();

      // Triangle indicator at top
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(px - 5, scrollTop);
      ctx.lineTo(px + 5, scrollTop);
      ctx.lineTo(px, scrollTop + 8);
      ctx.closePath();
      ctx.fill();
    }

    // ── Mini keyboard strip ────────────────────────────────────────────────
    for (let midi = MIDI_MIN; midi < MIDI_MAX; midi++) {
      const y   = midiToY(midi);
      const blk = isBlackKey(midi);
      const pc  = midi % 12;

      // Key background
      ctx.fillStyle = blk ? '#1a1a2e' : '#e5e7eb';
      ctx.fillRect(0, y, KEY_WIDTH - 2, ROW_HEIGHT - 1);

      // C labels
      if (pc === 0) {
        const octave = Math.floor(midi / 12) - 1;
        ctx.fillStyle = '#6366f1';
        ctx.font      = 'bold 8px Inter, sans-serif';
        ctx.fillText(`C${octave}`, 2, y + ROW_HEIGHT - 3);
      }

      // Separator
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, y + ROW_HEIGHT - 1, KEY_WIDTH - 2, 1);
    }
  }, [
    canvasW, canvasH, tracks, playheadBeats,
    loopEnabled, loopStart, loopEnd,
    snapGrid, totalBeats,
  ]);

  // ── Trigger redraw on any relevant state change ───────────────────────────
  useEffect(() => {
    draw();
  }, [draw]);

  // Also redraw on scroll (bar numbers / playhead need scroll offset)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => draw();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [draw]);

  // ── Hit-test helpers ──────────────────────────────────────────────────────

  function hitTest(canvasX, canvasY) {
    // Check all tracks for note hit, top-most track wins
    for (let ti = tracks.length - 1; ti >= 0; ti--) {
      const track = tracks[ti];
      for (const note of track.notes) {
        const nx = KEY_WIDTH + beatToX(note.startBeat);
        const ny = midiToY(note.pitch);
        const nw = Math.max(2, beatToX(note.durationBeats));
        const nh = ROW_HEIGHT;

        if (canvasX >= nx && canvasX <= nx + nw &&
            canvasY >= ny && canvasY <= ny + nh) {
          // Is it on the resize handle (right 8px)?
          const onResize = canvasX > nx + nw - 8;
          return { track, note, onResize };
        }
      }
    }
    return null;
  }

  function canvasCoords(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const scl = containerRef.current;
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  // ── Pointer events ────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    const { x, y } = canvasCoords(e);
    if (x < KEY_WIDTH) return; // ignore keyboard strip clicks

    const hit = hitTest(x, y);
    const clickBeat  = xToBeat(x - KEY_WIDTH);
    const clickPitch = yToMidi(y);

    // Right-click → delete
    if (e.button === 2) {
      if (hit) deleteNote(hit.track.id, hit.note.id);
      return;
    }

    // Shift+drag → loop region
    if (e.shiftKey) {
      drag.current = { mode: 'loop', startBeat: clickBeat };
      setLoop(clickBeat, clickBeat + 4);
      return;
    }

    if (hit) {
      if (hit.onResize) {
        // Resize mode
        drag.current = {
          mode:      'resize',
          trackId:   hit.track.id,
          noteId:    hit.note.id,
          origNote:  { ...hit.note },
          startX:    x,
        };
      } else {
        // Move mode
        drag.current = {
          mode:      'move',
          trackId:   hit.track.id,
          noteId:    hit.note.id,
          origNote:  { ...hit.note },
          startX:    x,
          startY:    y,
        };
      }
    } else {
      // Draw new note on the selected track
      if (!selectedTrackId) return;
      const rawBeat  = snapEnabled ? snapBeat(clickBeat, snapGrid) : clickBeat;
      const pitch    = Math.min(MIDI_MAX - 1, Math.max(MIDI_MIN, clickPitch));
      const newNote  = {
        pitch,
        startBeat:     rawBeat,
        durationBeats: SNAP_VALUES[snapGrid] ?? 0.5,
      };
      addNote(selectedTrackId, newNote);

      // Get the newly added note id (it's the last note in the selected track)
      // Store temporarily for drag-to-resize
      drag.current = {
        mode:      'draw',
        trackId:   selectedTrackId,
        startBeat: rawBeat,
        pitch,
        startX:    x,
      };
    }

    canvasRef.current.setPointerCapture(e.pointerId);
  }, [
    tracks, selectedTrackId, snapEnabled, snapGrid,
    addNote, deleteNote, setLoop,
  ]);

  const onPointerMove = useCallback((e) => {
    if (!drag.current) return;
    const { x, y } = canvasCoords(e);
    const d = drag.current;

    if (d.mode === 'loop') {
      const curBeat   = Math.max(0, xToBeat(x - KEY_WIDTH));
      const [ls, le]  = curBeat >= d.startBeat
        ? [d.startBeat, curBeat]
        : [curBeat, d.startBeat];
      setLoop(ls, Math.max(le, ls + 0.25));
      return;
    }

    if (d.mode === 'resize') {
      const curBeat     = Math.max(0, xToBeat(x - KEY_WIDTH));
      const rawDur      = curBeat - d.origNote.startBeat;
      const snappedDur  = snapEnabled
        ? Math.max(MIN_DUR_BEATS, snapBeat(rawDur, snapGrid))
        : Math.max(MIN_DUR_BEATS, rawDur);
      updateNote(d.trackId, d.noteId, { durationBeats: snappedDur });
      return;
    }

    if (d.mode === 'move') {
      const dx = x - d.startX;
      const dy = y - d.startY;
      const rawBeat  = d.origNote.startBeat + xToBeat(dx);
      const newBeat  = snapEnabled
        ? Math.max(0, snapBeat(rawBeat, snapGrid))
        : Math.max(0, rawBeat);
      const pitchDelta = -Math.round(dy / ROW_HEIGHT);
      const newPitch   = Math.min(MIDI_MAX - 1, Math.max(MIDI_MIN, d.origNote.pitch + pitchDelta));
      updateNote(d.trackId, d.noteId, { startBeat: newBeat, pitch: newPitch });
      return;
    }

    if (d.mode === 'draw') {
      // Extend duration of the just-drawn note
      const curBeat = Math.max(0, xToBeat(x - KEY_WIDTH));
      const rawDur  = curBeat - d.startBeat;
      const snapDur = snapEnabled
        ? Math.max(MIN_DUR_BEATS, snapBeat(rawDur, snapGrid))
        : Math.max(MIN_DUR_BEATS, rawDur);

      // Find the freshly added note (last note matching startBeat+pitch on track)
      const track = tracks.find((t) => t.id === d.trackId);
      if (!track) return;
      const note  = [...track.notes]
        .reverse()
        .find((n) => n.startBeat === d.startBeat && n.pitch === d.pitch);
      if (note) updateNote(d.trackId, note.id, { durationBeats: snapDur });
    }
  }, [tracks, snapEnabled, snapGrid, updateNote, setLoop]);

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  // Cursor style
  const [cursor, setCursor] = useState('crosshair');
  const onPointerMoveForCursor = useCallback((e) => {
    const { x, y } = canvasCoords(e);
    if (x < KEY_WIDTH) { setCursor('default'); return; }
    const hit = hitTest(x, y);
    if (!hit) setCursor('crosshair');
    else if (hit.onResize) setCursor('ew-resize');
    else setCursor('grab');
  }, [tracks]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ruler strip ───────────────────────────────────────────────────────────
  // Separate small canvas for the top bar/beat ruler (sticky positioned)

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto bg-[#0b0b18]"
      style={{
        flex:      '1 1 0',
        minHeight: 0,
        minWidth:  0,
        cursor,
      }}
    >
      {/* Ruler */}
      <div
        className="sticky top-0 z-10 flex"
        style={{
          width:      canvasW,
          height:     22,
          background: '#0e0e1e',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Keyboard placeholder */}
        <div style={{ width: KEY_WIDTH, flexShrink: 0 }} />
        {/* Bar numbers */}
        {Array.from({ length: totalBars }, (_, i) => (
          <div
            key={i}
            style={{ width: BEAT_WIDTH * 4, flexShrink: 0 }}
            className="text-[9px] text-slate-600 font-mono border-r border-white/6
                       flex items-center px-1.5"
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Main piano roll canvas */}
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        style={{ display: 'block' }}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => { onPointerMove(e); onPointerMoveForCursor(e); }}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Piano roll editor"
      />
    </div>
  );
}
