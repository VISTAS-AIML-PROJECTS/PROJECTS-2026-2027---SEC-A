/**
 * musicTheory.js
 * --------------
 * Pure, rule-based music theory utilities for the AI accompaniment features.
 * NO machine learning — all logic is deterministic music theory.
 *
 * Exports:
 *   suggestBassline(notes)  — derives root notes + fifth pattern from a melody/chord track
 *   suggestChords(notes)    — derives diatonic triads under a melody line
 *   detectKey(notes)        — Krumhansl-Schmuckler-inspired key detection
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Diatonic semitone intervals for major scale: W W H W W W H
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

// Diatonic semitone intervals for natural minor scale: W H W W H W W
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

// Krumhansl-Schmuckler key profiles (major and minor)
// Source: Krumhansl, C.L. (1990). Cognitive Foundations of Musical Pitch.
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Triad types per scale degree (major scale): maj min min maj maj min dim
const MAJOR_SCALE_TRIAD_TYPES = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];

// Triad intervals
const TRIAD_INTERVALS = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a unique ID for a note.
 * @returns {string}
 */
function noteId() {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Dot product of two equal-length arrays.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function dot(a, b) {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

/**
 * Normalize an array to zero mean and unit variance.
 * @param {number[]} arr
 * @returns {number[]}
 */
function normalize(arr) {
  const n    = arr.length;
  const mean = arr.reduce((s, v) => s + v, 0) / n;
  const std  = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / n) || 1;
  return arr.map((v) => (v - mean) / std);
}

/**
 * Rotate an array by `n` positions to the left.
 * @param {number[]} arr
 * @param {number} n
 * @returns {number[]}
 */
function rotateLeft(arr, n) {
  const len = arr.length;
  return arr.map((_, i) => arr[(i + n) % len]);
}

// ── Key Detection ─────────────────────────────────────────────────────────────

/**
 * Detect the most likely key (root + mode) from a set of notes using a
 * simplified Krumhansl-Schmuckler correlation.
 *
 * @param {{ pitch: number }[]} notes  — array of note objects with MIDI pitch
 * @returns {{ root: number, mode: 'major'|'minor' }}
 *   root = pitch class 0–11 (0=C, 1=C#, …)
 */
export function detectKey(notes) {
  if (!notes.length) return { root: 0, mode: 'major' };

  // Build pitch-class histogram
  const histogram = new Array(12).fill(0);
  for (const note of notes) {
    histogram[note.pitch % 12] += 1;
  }
  const normHistogram = normalize(histogram);
  const normMajor     = normalize(KK_MAJOR);
  const normMinor     = normalize(KK_MINOR);

  let bestScore  = -Infinity;
  let bestRoot   = 0;
  let bestMode   = 'major';

  for (let root = 0; root < 12; root++) {
    const rotatedMaj = rotateLeft(normMajor, root);
    const rotatedMin = rotateLeft(normMinor, root);

    const majScore = dot(normHistogram, rotatedMaj);
    const minScore = dot(normHistogram, rotatedMin);

    if (majScore > bestScore) { bestScore = majScore; bestRoot = root; bestMode = 'major'; }
    if (minScore > bestScore) { bestScore = minScore; bestRoot = root; bestMode = 'minor'; }
  }

  return { root: bestRoot, mode: bestMode };
}

// ── Bassline Generation ───────────────────────────────────────────────────────

/**
 * Suggest a bassline from a melody/chord track.
 *
 * Algorithm:
 *   1. Group notes by 1-bar windows.
 *   2. Find the lowest pitch (assumed chord root) in each window.
 *   3. Generate a root-fifth-root-fifth pattern on beats 1/2/3/4 of each bar.
 *   4. Bass plays root at octave 2–3 (one octave below the source notes).
 *
 * @param {{ pitch: number, startBeat: number, durationBeats: number }[]} notes
 * @param {number} totalBars
 * @returns {{ pitch: number, startBeat: number, durationBeats: number, id: string }[]}
 */
export function suggestBassline(notes, totalBars = 8) {
  if (!notes.length) return [];

  const beatsPerBar = 4;
  const bassNotes   = [];

  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = bar * beatsPerBar;
    const barEnd   = barStart + beatsPerBar;

    // Collect notes that sound within this bar
    const barNotes = notes.filter(
      (n) => n.startBeat < barEnd && n.startBeat + n.durationBeats > barStart,
    );

    if (!barNotes.length) continue;

    // Root: lowest pitch in the bar, dropped to a bass octave (MIDI 36–47)
    const lowestPitch = Math.min(...barNotes.map((n) => n.pitch));
    const pitchClass  = lowestPitch % 12;

    // Target MIDI octave 2 (root around 36–47)
    const targetRoot  = pitchClass + 36;
    const fifth       = targetRoot + 7; // perfect fifth above root

    // Pattern: root quarter / fifth quarter / root quarter / fifth quarter
    const pattern = [
      { beat: 0, pitch: targetRoot },
      { beat: 1, pitch: fifth      },
      { beat: 2, pitch: targetRoot },
      { beat: 3, pitch: fifth      },
    ];

    for (const { beat, pitch } of pattern) {
      bassNotes.push({
        id:            noteId(),
        pitch,
        startBeat:     barStart + beat,
        durationBeats: 1,
      });
    }
  }

  return bassNotes;
}

// ── Chord Suggestion ──────────────────────────────────────────────────────────

/**
 * Suggest diatonic triads to accompany a single melody line.
 *
 * Algorithm:
 *   1. Detect the key from the melody notes.
 *   2. For each half-bar (2 beats), find the most common melody pitch class.
 *   3. Choose the diatonic triad whose root is closest below the melody note.
 *   4. Place triads starting at MIDI octave 3 (C3 = 48), beat-aligned.
 *
 * @param {{ pitch: number, startBeat: number, durationBeats: number }[]} notes
 * @param {number} totalBars
 * @returns {{ pitch: number, startBeat: number, durationBeats: number, id: string }[]}
 */
export function suggestChords(notes, totalBars = 8) {
  if (!notes.length) return [];

  const { root: keyRoot, mode } = detectKey(notes);
  const scaleIntervals = mode === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS;

  // Build the scale as absolute pitch classes
  const scale = scaleIntervals.map((interval) => (keyRoot + interval) % 12);

  const beatsPerBar  = 4;
  const windowBeats  = 2; // place one chord every 2 beats
  const totalWindows = Math.ceil((totalBars * beatsPerBar) / windowBeats);
  const chordNotes   = [];

  for (let w = 0; w < totalWindows; w++) {
    const windowStart = w * windowBeats;
    const windowEnd   = windowStart + windowBeats;

    const windowMelody = notes.filter(
      (n) => n.startBeat < windowEnd && n.startBeat + n.durationBeats > windowStart,
    );
    if (!windowMelody.length) continue;

    // Find the most common pitch class in this window
    const pcCount = new Array(12).fill(0);
    for (const n of windowMelody) pcCount[n.pitch % 12]++;
    let dominantPC = 0;
    for (let i = 1; i < 12; i++) {
      if (pcCount[i] > pcCount[dominantPC]) dominantPC = i;
    }

    // Find the diatonic scale degree whose pitch class is closest below dominantPC
    let bestDegree  = 0;
    let bestDistance = Infinity;
    for (let deg = 0; deg < scale.length; deg++) {
      const dist = (dominantPC - scale[deg] + 12) % 12;
      if (dist < bestDistance) {
        bestDistance = dist;
        bestDegree   = deg;
      }
    }

    // Build the triad for this scale degree
    const triadType      = mode === 'major'
      ? MAJOR_SCALE_TRIAD_TYPES[bestDegree]
      : ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'][bestDegree];
    const intervals      = TRIAD_INTERVALS[triadType] ?? TRIAD_INTERVALS.maj;
    const chordRootMidi  = 48 + scale[bestDegree]; // octave 3

    for (const interval of intervals) {
      chordNotes.push({
        id:            noteId(),
        pitch:         chordRootMidi + interval,
        startBeat:     windowStart,
        durationBeats: windowBeats,
      });
    }
  }

  return chordNotes;
}

// ── Explanation strings ───────────────────────────────────────────────────────

/**
 * Human-readable explanation for a generated bassline.
 * @param {{ root: number, mode: string }} key
 * @returns {string}
 */
export function basslineExplanation(key) {
  const rootName = NOTE_NAMES[key.root];
  return (
    `Added a bassline in ${rootName} ${key.mode}. ` +
    `Each bar plays the chord root on beats 1 & 3 and the perfect fifth on beats 2 & 4, ` +
    `giving a classic walking-bass feel. The bass notes are transposed down to octave 2 ` +
    `so they sit comfortably below your melody.`
  );
}

/**
 * Human-readable explanation for generated chord accompaniment.
 * @param {{ root: number, mode: string }} key
 * @returns {string}
 */
export function chordsExplanation(key) {
  const rootName = NOTE_NAMES[key.root];
  return (
    `Added diatonic triads in ${rootName} ${key.mode}. ` +
    `The chords are chosen by matching each 2-beat window of your melody to the ` +
    `nearest scale degree, then placing the standard triad (major, minor, or diminished) ` +
    `for that degree. This keeps everything in-key without forcing any non-diatonic harmony.`
  );
}
