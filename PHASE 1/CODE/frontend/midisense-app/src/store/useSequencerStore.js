/**
 * useSequencerStore.js
 * --------------------
 * Zustand store for all Sequencer page state.
 *
 * Note: tempo is deliberately NOT duplicated here — the sequencer reads it
 * from usePracticeStore (which already persists it) so the two pages share
 * the same BPM setting.
 *
 * Track shape:
 *   {
 *     id:         string,
 *     name:       string,
 *     instrument: 'piano' | 'bass',
 *     muted:      boolean,
 *     soloed:     boolean,
 *     color:      string,          // CSS color string for note blocks
 *     notes: [
 *       {
 *         id:            string,
 *         pitch:         number,   // MIDI note number (21–108)
 *         startBeat:     number,   // position in quarter-note beats from beat 0
 *         durationBeats: number,   // length in quarter-note beats
 *       }
 *     ]
 *   }
 */

import { create } from 'zustand';
import {
  suggestBassline,
  suggestChords,
  detectKey,
  basslineExplanation,
  chordsExplanation,
} from '../utils/musicTheory';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Palette for auto-assigning track colors */
const TRACK_COLORS = [
  '#818cf8', // indigo-400
  '#34d399', // emerald-400
  '#fb923c', // orange-400
  '#f472b6', // pink-400
  '#facc15', // yellow-400
  '#22d3ee', // cyan-400
  '#a78bfa', // violet-400
  '#4ade80', // green-400
];

let _trackColorIndex = 0;
function nextColor() {
  const color = TRACK_COLORS[_trackColorIndex % TRACK_COLORS.length];
  _trackColorIndex++;
  return color;
}

function trackId() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function noteId() {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Snap helpers ──────────────────────────────────────────────────────────────

/** Map of snap grid labels to beat fractions */
export const SNAP_VALUES = {
  '1/4':  1,
  '1/8':  0.5,
  '1/16': 0.25,
};

/**
 * Snap a beat value to the nearest grid line.
 * @param {number} beat
 * @param {string} grid   — '1/4' | '1/8' | '1/16'
 * @returns {number}
 */
export function snapBeat(beat, grid) {
  const step = SNAP_VALUES[grid] ?? 1;
  return Math.round(beat / step) * step;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const useSequencerStore = create((set, get) => ({
  // ── Tracks ────────────────────────────────────────────────────────────────
  tracks:          [],
  selectedTrackId: null,

  addTrack: (instrument = 'piano') => {
    const id    = trackId();
    const index = get().tracks.length + 1;
    const track = {
      id,
      name:       `Track ${index}`,
      instrument,
      muted:      false,
      soloed:     false,
      color:      nextColor(),
      notes:      [],
    };
    set((s) => ({
      tracks:          [...s.tracks, track],
      selectedTrackId: id,
    }));
    return id;
  },

  removeTrack: (trackId) =>
    set((s) => {
      const tracks  = s.tracks.filter((t) => t.id !== trackId);
      const selId   = s.selectedTrackId === trackId
        ? (tracks[0]?.id ?? null)
        : s.selectedTrackId;
      return { tracks, selectedTrackId: selId };
    }),

  updateTrack: (trackId, patch) =>
    set((s) => ({
      tracks: s.tracks.map((t) => t.id === trackId ? { ...t, ...patch } : t),
    })),

  setSelectedTrack: (trackId) => set({ selectedTrackId: trackId }),

  // ── Notes ─────────────────────────────────────────────────────────────────

  addNote: (trackId, note) =>
    set((s) => ({
      tracks: s.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return { ...t, notes: [...t.notes, { ...note, id: noteId() }] };
      }),
    })),

  updateNote: (trackId, noteId, patch) =>
    set((s) => ({
      tracks: s.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          notes: t.notes.map((n) => n.id === noteId ? { ...n, ...patch } : n),
        };
      }),
    })),

  deleteNote: (trackId, noteId) =>
    set((s) => ({
      tracks: s.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return { ...t, notes: t.notes.filter((n) => n.id !== noteId) };
      }),
    })),

  // Replace all notes on a track (used by AI features + load)
  setTrackNotes: (trackId, notes) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, notes } : t,
      ),
    })),

  // ── Playback state ────────────────────────────────────────────────────────
  isPlaying:   false,
  isRecording: false,
  setPlaying:   (v) => set({ isPlaying: v }),
  setRecording: (v) => set({ isRecording: v }),

  // ── Loop region ───────────────────────────────────────────────────────────
  loopStart:   0,
  loopEnd:     8,   // 2 bars
  loopEnabled: false,
  setLoop: (start, end) => set({ loopStart: start, loopEnd: end }),
  toggleLoop: () => set((s) => ({ loopEnabled: !s.loopEnabled })),

  // ── Snap / quantize ───────────────────────────────────────────────────────
  snapGrid:         '1/8',
  snapEnabled:      true,
  quantizeOnRecord: false,
  setSnapGrid:      (grid) => set({ snapGrid: grid }),
  toggleSnap:       () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  toggleQuantize:   () => set((s) => ({ quantizeOnRecord: !s.quantizeOnRecord })),

  /** Snap every note on the selected track to the current snap grid */
  quantizeNotes: () => {
    const { tracks, selectedTrackId, snapGrid } = get();
    const track = tracks.find((t) => t.id === selectedTrackId);
    if (!track || !track.notes.length) return;
    const step = SNAP_VALUES[snapGrid] ?? 1;
    set((s) => ({
      tracks: s.tracks.map((t) => {
        if (t.id !== selectedTrackId) return t;
        return {
          ...t,
          notes: t.notes.map((n) => ({
            ...n,
            startBeat: snapBeat(n.startBeat, snapGrid),
            durationBeats: Math.max(step, snapBeat(n.durationBeats, snapGrid)),
          })),
        };
      }),
    }));
  },

  // ── Project settings ──────────────────────────────────────────────────────
  totalBars: 8,
  setTotalBars: (n) => set({ totalBars: Math.max(2, Math.min(64, n)) }),

  // ── AI explanation modal ──────────────────────────────────────────────────
  aiModal: null,   // null | { title: string, message: string }
  setAiModal: (modal) => set({ aiModal: modal }),
  closeAiModal: () => set({ aiModal: null }),

  // ── Bulk load (from Firestore) ────────────────────────────────────────────
  loadProject: (project) =>
    set({
      tracks:          project.tracks      ?? [],
      totalBars:       project.totalBars   ?? 8,
      loopEnabled:     project.loopEnabled ?? false,
      loopStart:       project.loopStart   ?? 0,
      loopEnd:         project.loopEnd     ?? 8,
      selectedTrackId: project.tracks?.[0]?.id ?? null,
    }),

  // ── AI: Suggest Bassline ──────────────────────────────────────────────────
  suggestBassline: () => {
    const { tracks, selectedTrackId, totalBars, addTrack, setTrackNotes } = get();
    const sourceTrack = tracks.find((t) => t.id === selectedTrackId);
    if (!sourceTrack || !sourceTrack.notes.length) return;

    const key       = detectKey(sourceTrack.notes);
    const bassNotes = suggestBassline(sourceTrack.notes, totalBars);
    const newId     = addTrack('bass');
    // Give the new track a specific name
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === newId ? { ...t, name: 'AI Bassline', instrument: 'bass' } : t,
      ),
    }));
    setTrackNotes(newId, bassNotes);
    set({ aiModal: { title: 'Bassline Added', message: basslineExplanation(key) } });
  },

  // ── AI: Suggest Chords ────────────────────────────────────────────────────
  suggestChords: () => {
    const { tracks, selectedTrackId, totalBars, addTrack, setTrackNotes } = get();
    const sourceTrack = tracks.find((t) => t.id === selectedTrackId);
    if (!sourceTrack || !sourceTrack.notes.length) return;

    const key        = detectKey(sourceTrack.notes);
    const chordNotes = suggestChords(sourceTrack.notes, totalBars);
    const newId      = addTrack('piano');
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === newId ? { ...t, name: 'AI Chords' } : t,
      ),
    }));
    setTrackNotes(newId, chordNotes);
    set({ aiModal: { title: 'Chords Added', message: chordsExplanation(key) } });
  },
}));

export default useSequencerStore;
