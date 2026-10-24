/**
 * useMetronomeAudio.js
 * --------------------
 * React hook that drives the metronome using Tone.js Transport.
 *
 * Why Tone.Transport (not setInterval/setTimeout):
 *   Raw JS timers are scheduled on the main thread and are subject to
 *   jitter from garbage collection, layout, and event handling.
 *   Tone.Transport uses the Web Audio API's hardware clock, which
 *   remains sample-accurate regardless of main-thread pressure.
 *
 * Sounds:
 *   Beat 1 (accent): Tone.MembraneSynth — lower, punchier thud
 *   Beats 2–4:       Tone.NoiseSynth  — short hi-hat-style click
 *
 * The hook reads `metronomeOn` and `tempo` from usePracticeStore and
 * reacts to their changes automatically — no props needed.
 * Mount once in PracticePage and it self-manages its lifecycle.
 */

import { useEffect, useRef } from 'react';
import * as Tone from 'tone';
import usePracticeStore from '../store/usePracticeStore';

export default function useMetronomeAudio() {
  const metronomeOn = usePracticeStore((s) => s.metronomeOn);
  const tempo       = usePracticeStore((s) => s.tempo);

  const accentRef   = useRef(null); // MembraneSynth for beat 1
  const clickRef    = useRef(null); // NoiseSynth for beats 2–4
  const beatRef     = useRef(0);    // running beat counter (0-indexed)
  const eventIdRef  = useRef(null); // Tone.Transport event ID (for cancellation)

  // ── Create synths once on mount ─────────────────────────────────────────────
  useEffect(() => {
    // Accent (beat 1): low-pitched membrane thump
    const accent = new Tone.MembraneSynth({
      pitchDecay:  0.04,
      octaves:     6,
      envelope: {
        attack:  0.001,
        decay:   0.15,
        sustain: 0,
        release: 0.1,
      },
      volume: -4,
    }).toDestination();

    // Regular click (beats 2-4): very short filtered noise burst
    const click = new Tone.NoiseSynth({
      noise:    { type: 'white' },
      envelope: {
        attack:  0.001,
        decay:   0.04,
        sustain: 0,
        release: 0.02,
      },
      volume: -14,
    });

    // High-pass filter so the click is crisp, not muddy
    const hpf = new Tone.Filter(2500, 'highpass').toDestination();
    click.connect(hpf);

    accentRef.current = accent;
    clickRef.current  = click;

    return () => {
      accent.dispose();
      click.dispose();
      hpf.dispose();
    };
  }, []);

  // ── Sync BPM to Transport whenever tempo changes ─────────────────────────────
  useEffect(() => {
    Tone.getTransport().bpm.value = tempo;
  }, [tempo]);

  // ── Start / stop Transport when metronomeOn changes ──────────────────────────
  useEffect(() => {
    const transport = Tone.getTransport();

    if (metronomeOn) {
      // Ensure AudioContext is running (requires prior user gesture)
      Tone.start().then(() => {
        // Apply current BPM (may have changed while paused)
        transport.bpm.value = tempo;

        // Reset beat counter so beat 1 always gets the accent on start
        beatRef.current = 0;

        // Schedule a repeating callback every quarter note
        const id = transport.scheduleRepeat((time) => {
          const beat = beatRef.current % 4; // 4/4 time signature

          if (beat === 0) {
            // Beat 1 accent — low "G2" thud, slightly louder
            accentRef.current?.triggerAttackRelease('G2', '16n', time);
          } else {
            // Beats 2–4 — dry click
            clickRef.current?.triggerAttackRelease('16n', time);
          }

          beatRef.current += 1;
        }, '4n'); // fire every quarter note

        eventIdRef.current = id;
        transport.start();
      });
    } else {
      // Stop Transport and cancel the scheduled repeat
      transport.stop();
      if (eventIdRef.current !== null) {
        transport.cancel(0);   // remove all scheduled events
        eventIdRef.current = null;
      }
      beatRef.current = 0;
    }

    return () => {
      // Cleanup if the effect re-runs (e.g. metronomeOn flips rapidly)
      transport.stop();
      if (eventIdRef.current !== null) {
        transport.cancel(0);
        eventIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metronomeOn]); // intentionally omit `tempo` — BPM is updated live in the effect above
}
