/**
 * exportMidi.js
 * -------------
 * Client-side MIDI file generation using jsmidgen.
 *
 * Library: jsmidgen (npm)
 *   Chosen because: small (~8KB), pure JS, actively maintained,
 *   no WASM, no native bindings — runs entirely in the browser.
 *
 * @see https://www.npmjs.com/package/jsmidgen
 */

import Midi from 'jsmidgen';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert beats (quarter notes) to MIDI ticks.
 * jsmidgen default ticksPerBeat = 128.
 * @param {number} beats
 * @param {number} tpb  — ticks per beat (default 128)
 * @returns {number}
 */
function beatsToTicks(beats, tpb = 128) {
  return Math.round(beats * tpb);
}

// ── Main export function ──────────────────────────────────────────────────────

/**
 * Generate a standard MIDI file from sequencer tracks and trigger a download.
 *
 * @param {{ id:string, name:string, instrument:string, notes: object[] }[]} tracks
 * @param {number} tempo   — BPM
 * @param {string} filename — download filename (default: 'project.mid')
 */
export function exportMidi(tracks, tempo = 90, filename = 'project.mid') {
  const TICKS_PER_BEAT = 128;

  // Create a new MIDI file (format 1 = multi-track)
  const file = new Midi.File();

  for (const track of tracks) {
    if (!track.notes.length) continue;

    const midiTrack = new Midi.Track();
    file.addTrack(midiTrack);

    // Set track name
    midiTrack.addText(track.name);

    // Set tempo (microseconds per beat)
    midiTrack.setTempo(Math.round(60_000_000 / tempo));

    // Sort notes by start position
    const sorted = [...track.notes].sort((a, b) => a.startBeat - b.startBeat);

    // jsmidgen works with delta ticks, so we track the current cursor
    let cursorTicks = 0;

    for (const note of sorted) {
      const startTicks = beatsToTicks(note.startBeat, TICKS_PER_BEAT);
      const durTicks   = beatsToTicks(note.durationBeats, TICKS_PER_BEAT);
      const delta      = startTicks - cursorTicks;

      // Note-on (channel 0, velocity 80)
      midiTrack.addNote(
        0,           // channel
        note.pitch,  // MIDI note number
        durTicks,    // duration in ticks
        delta,       // delta from previous event
        80,          // velocity
      );

      cursorTicks = startTicks + durTicks;
    }
  }

  // Serialize to binary and trigger browser download
  const bytes  = file.toBytes();
  const uint8  = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    uint8[i] = bytes.charCodeAt(i);
  }

  const blob = new Blob([uint8], { type: 'audio/midi' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
