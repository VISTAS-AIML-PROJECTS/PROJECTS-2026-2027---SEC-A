/**
 * usePianoAudio.js
 */

import {
  useRef,
  useEffect,
  useCallback,
} from 'react';

import * as Tone from 'tone';

const FM_PIANO_OPTIONS = {
  oscillator: {
    type: 'sine',
  },

  envelope: {
    attack: 0.002,
    decay: 1.2,
    sustain: 0.3,
    release: 0.8,
  },

  modulation: {
    type: 'square',
  },

  modulationEnvelope: {
    attack: 0.002,
    decay: 0.3,
    sustain: 0.1,
    release: 0.5,
  },

  modulationIndex: 3,
  harmonicity: 3.5,
  volume: -6,

  // Prevent excessive voices
  maxPolyphony: 16,
};

export default function usePianoAudio() {
  const synthRef = useRef(null);
  const reverbRef = useRef(null);
  const startedRef = useRef(false);

  // Notes currently sounding
  const activeNotesRef = useRef(new Set());

  useEffect(() => {
    const synth = new Tone.PolySynth(
      Tone.FMSynth,
      FM_PIANO_OPTIONS
    );

    const reverb = new Tone.Reverb({
      decay: 1.8,
      preDelay: 0.01,
      wet: 0.25,
    }).toDestination();

    synth.connect(reverb);

    synthRef.current = synth;
    reverbRef.current = reverb;

    return () => {
      activeNotesRef.current.clear();

      synth.releaseAll();

      synth.dispose();
      reverb.dispose();

      synthRef.current = null;
      reverbRef.current = null;
      startedRef.current = false;
    };
  }, []);

  const ensureStarted = useCallback(async () => {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }

    startedRef.current = true;
  }, []);

  const playNote = useCallback(
    async (noteName, duration = null) => {
      const synth = synthRef.current;

      if (!synth || !noteName) {
        return;
      }

      // Ignore duplicate attack for same note
      if (activeNotesRef.current.has(noteName)) {
        return;
      }

      try {
        await ensureStarted();

        if (!synthRef.current) {
          return;
        }

        activeNotesRef.current.add(noteName);

        if (duration) {
          synth.triggerAttackRelease(
            noteName,
            duration
          );

          setTimeout(() => {
            activeNotesRef.current.delete(noteName);
          }, 1000);
        } else {
          synth.triggerAttack(noteName);
        }
      } catch (error) {
        activeNotesRef.current.delete(noteName);

        console.warn(
          'Piano audio error:',
          error
        );
      }
    },
    [ensureStarted]
  );

  const releaseNote = useCallback((noteName) => {
    const synth = synthRef.current;

    if (!synth || !noteName) {
      return;
    }

    try {
      synth.triggerRelease(noteName);
    } catch (_) {
      // Ignore release errors
    }

    activeNotesRef.current.delete(noteName);
  }, []);

  return {
    playNote,
    releaseNote,
  };
}