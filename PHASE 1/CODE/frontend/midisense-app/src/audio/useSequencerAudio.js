/**
 * useSequencerAudio.js
 * --------------------
 * React hook that manages all audio playback for the Sequencer page.
 *
 * Instruments:
 *   piano tracks — Tone.PolySynth(FMSynth) (same parameters as usePianoAudio)
 *   bass  tracks — Tone.MonoSynth (monophonic, punchy for bass lines)
 *
 * Transport integration:
 *   Uses the shared Tone.Transport (same instance the metronome uses).
 *   The sequencer manages it exclusively while mounted — it resets on unmount.
 *
 * Usage:
 *   const { play, pause, stop, playheadBeats } = useSequencerAudio();
 *   // playheadBeats is a React state value updated ~60fps via rAF
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import * as Tone from 'tone';
import useSequencerStore from '../store/useSequencerStore';
import usePracticeStore  from '../store/usePracticeStore';

// ── Synth factory ─────────────────────────────────────────────────────────────

const FM_PIANO_OPTIONS = {
  oscillator:         { type: 'sine' },
  envelope:           { attack: 0.002, decay: 1.2, sustain: 0.3, release: 0.8 },
  modulation:         { type: 'square' },
  modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0.1, release: 0.5 },
  modulationIndex:    3,
  harmonicity:        3.5,
  volume:             -6,
};

function createPianoSynth() {
  const synth  = new Tone.PolySynth(Tone.FMSynth, FM_PIANO_OPTIONS);
  const reverb = new Tone.Reverb({ decay: 1.8, preDelay: 0.01, wet: 0.2 }).toDestination();
  synth.connect(reverb);
  return { synth, reverb };
}

function createBassSynth() {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'triangle' },
    envelope:   { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.4 },
    filter:     { type: 'lowpass', frequency: 800, rolloff: -24 },
    volume:     -4,
  }).toDestination();
  return { synth };
}

// ── MIDI note → Tone.js note name ─────────────────────────────────────────────
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function midiToTone(midi) {
  const pc     = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export default function useSequencerAudio() {
  const tracks     = useSequencerStore((s) => s.tracks);
  const loopStart  = useSequencerStore((s) => s.loopStart);
  const loopEnd    = useSequencerStore((s) => s.loopEnd);
  const loopEnabled = useSequencerStore((s) => s.loopEnabled);
  const setPlaying  = useSequencerStore((s) => s.setPlaying);
  const tempo       = usePracticeStore((s) => s.tempo);

  const pianoRef = useRef(null);  // { synth, reverb }
  const bassRef  = useRef(null);  // { synth }
  const partsRef = useRef([]);    // active Tone.Part instances

  const [playheadBeats, setPlayheadBeats] = useState(0);
  const rafRef = useRef(null);

  // ── Create synths on mount ─────────────────────────────────────────────────
  useEffect(() => {
    pianoRef.current = createPianoSynth();
    bassRef.current  = createBassSynth();

    return () => {
      // Stop transport and dispose on unmount
      const t = Tone.getTransport();
      t.stop();
      t.cancel(0);
      pianoRef.current?.reverb?.dispose();
      pianoRef.current?.synth?.dispose();
      bassRef.current?.synth?.dispose();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Keep BPM in sync ──────────────────────────────────────────────────────
  useEffect(() => {
    Tone.getTransport().bpm.value = tempo;
  }, [tempo]);

  // ── Playhead rAF loop ─────────────────────────────────────────────────────
  const startPlayheadLoop = useCallback(() => {
    const transport = Tone.getTransport();
    function tick() {
      // Tone.Transport.seconds → beats
      const beatsPerSecond = transport.bpm.value / 60;
      const beats = transport.seconds * beatsPerSecond;
      setPlayheadBeats(beats);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopPlayheadLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Schedule helpers ──────────────────────────────────────────────────────

  /** Dispose all currently scheduled Tone.Part instances */
  const clearParts = useCallback(() => {
    for (const part of partsRef.current) {
      part.stop(0);
      part.dispose();
    }
    partsRef.current = [];
  }, []);

  /**
   * Build and start Tone.Part instances for all unmuted tracks.
   * Determines mute/solo behavior: if any track is soloed, only soloed tracks play.
   */
  const scheduleParts = useCallback(() => {
    const transport  = Tone.getTransport();
    const beatsPerSec = transport.bpm.value / 60;
    const hasSolo    = tracks.some((t) => t.soloed);

    for (const track of tracks) {
      const silenced = track.muted || (hasSolo && !track.soloed);
      if (silenced || !track.notes.length) continue;

      const synth = track.instrument === 'bass'
        ? bassRef.current?.synth
        : pianoRef.current?.synth;

      if (!synth) continue;

      // Build events: [time in seconds, note descriptor]
      const events = track.notes.map((n) => {
        const startSec    = n.startBeat / beatsPerSec;
        const durationSec = n.durationBeats / beatsPerSec;
        return [startSec, { pitch: n.pitch, durationSec }];
      });

      const part = new Tone.Part((time, { pitch, durationSec }) => {
        try {
          const noteName = midiToTone(pitch);
          if (synth instanceof Tone.PolySynth) {
            synth.triggerAttackRelease(noteName, durationSec, time);
          } else {
            synth.triggerAttackRelease(noteName, durationSec, time);
          }
        } catch (_) {
          // Silently ignore invalid note/synth state errors
        }
      }, events);

      part.start(0);
      partsRef.current.push(part);
    }

    // ── Loop region ──────────────────────────────────────────────────────────
    if (loopEnabled) {
      const bps = beatsPerSec;
      transport.loop      = true;
      transport.loopStart = loopStart / bps;
      transport.loopEnd   = loopEnd   / bps;
    } else {
      transport.loop = false;
    }
  }, [tracks, loopEnabled, loopStart, loopEnd]);

  // ── Public controls ───────────────────────────────────────────────────────

  const play = useCallback(async () => {
    await Tone.start();
    const transport = Tone.getTransport();

    clearParts();
    scheduleParts();
    transport.start();
    setPlaying(true);
    startPlayheadLoop();
  }, [clearParts, scheduleParts, setPlaying, startPlayheadLoop]);

  const pause = useCallback(() => {
    Tone.getTransport().pause();
    setPlaying(false);
    stopPlayheadLoop();
  }, [setPlaying, stopPlayheadLoop]);

  const stop = useCallback(() => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.loop = false;
    clearParts();
    setPlaying(false);
    setPlayheadBeats(0);
    stopPlayheadLoop();
  }, [clearParts, setPlaying, stopPlayheadLoop]);

  return { play, pause, stop, playheadBeats };
}
