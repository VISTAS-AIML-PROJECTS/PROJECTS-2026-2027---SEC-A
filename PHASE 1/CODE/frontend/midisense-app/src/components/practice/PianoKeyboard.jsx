import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import usePracticeStore from '../../store/usePracticeStore';
import usePianoAudio from '../../audio/usePianoAudio';
import MIDISenseAnalysis from '../../analysis-engine';

const WHITE_KEYS = [
  { note: 48, name: 'C3', key: '' },
  { note: 50, name: 'D3', key: '' },
  { note: 52, name: 'E3', key: '' },
  { note: 53, name: 'F3', key: '' },
  { note: 55, name: 'G3', key: '' },
  { note: 57, name: 'A3', key: '' },
  { note: 59, name: 'B3', key: '' },

  { note: 60, name: 'C4', key: 'A' },
  { note: 62, name: 'D4', key: 'S' },
  { note: 64, name: 'E4', key: 'D' },
  { note: 65, name: 'F4', key: 'F' },
  { note: 67, name: 'G4', key: 'G' },
  { note: 69, name: 'A4', key: 'H' },
  { note: 71, name: 'B4', key: 'J' },

  { note: 72, name: 'C5', key: 'K' },
  { note: 74, name: 'D5', key: 'L' },
  { note: 76, name: 'E5', key: ';' },
  { note: 77, name: 'F5', key: "'" },
  { note: 79, name: 'G5', key: '' },
  { note: 81, name: 'A5', key: '' },
  { note: 83, name: 'B5', key: '' },

  { note: 84, name: 'C6', key: '' },
  { note: 86, name: 'D6', key: '' },
  { note: 88, name: 'E6', key: '' },
  { note: 89, name: 'F6', key: '' },
  { note: 91, name: 'G6', key: '' },
  { note: 93, name: 'A6', key: '' },
  { note: 95, name: 'B6', key: '' },
];

const BLACK_KEYS = [
  { note: 49, name: 'C#3' },
  { note: 51, name: 'D#3' },
  { note: 54, name: 'F#3' },
  { note: 56, name: 'G#3' },
  { note: 58, name: 'A#3' },

  { note: 61, name: 'C#4' },
  { note: 63, name: 'D#4' },
  { note: 66, name: 'F#4' },
  { note: 68, name: 'G#4' },
  { note: 70, name: 'A#4' },

  { note: 73, name: 'C#5' },
  { note: 75, name: 'D#5' },
  { note: 78, name: 'F#5' },
  { note: 80, name: 'G#5' },
  { note: 82, name: 'A#5' },

  { note: 85, name: 'C#6' },
  { note: 87, name: 'D#6' },
  { note: 90, name: 'F#6' },
  { note: 92, name: 'G#6' },
  { note: 94, name: 'A#6' },
];

const ALL_KEYS = [
  ...WHITE_KEYS,
  ...BLACK_KEYS,
];

const noteNameFromMidi = (midiNote) => {
  const key = ALL_KEYS.find(
    (item) => item.note === midiNote
  );

  return (
    key?.name ||
    `MIDI ${midiNote}`
  );
};

const clamp = (
  value,
  min,
  max
) =>
  Math.max(
    min,
    Math.min(max, value)
  );

export default function PianoKeyboard({
  onNoteOn,
  onNoteOff,
  expectedNote: expectedNoteProp = null,
  targetNotes = [],
}) {
  const activeKeys =
    usePracticeStore(
      (s) => s.activeKeys
    );

  const activateKey =
    usePracticeStore(
      (s) => s.activateKey
    );

  const deactivateKey =
    usePracticeStore(
      (s) => s.deactivateKey
    );

  const setExpectedNote =
    usePracticeStore(
      (s) => s.setExpectedNote
    );

  const setMidiConnected =
    usePracticeStore(
      (s) => s.setMidiConnected
    );

  const recordPlayedNote =
    usePracticeStore(
      (s) => s.recordPlayedNote
    );

  const startPracticeSession =
    usePracticeStore(
      (s) => s.startPracticeSession
    );

  const updateAccuracy =
    usePracticeStore(
      (s) => s.updateAccuracy
    );

  const practiceStartedAt =
    usePracticeStore(
      (s) => s.practiceStartedAt
    );

  const requestRealtimeFeedback =
    usePracticeStore(
      (s) =>
        s.requestRealtimeFeedback
    );

  const pianoAudio =
    usePianoAudio();

  const [windowWidth, setWindowWidth] =
    useState(
      typeof window !== 'undefined'
        ? window.innerWidth
        : 1024
    );

  const midiAccessRef =
    useRef(null);

  const activeMidiNotes =
    useRef(new Set());

  const playedNotes =
    useRef([]);

  const activePlayedMidiNotes =
    useRef(new Map());

  const lessonAttempts =
    useRef(0);

  const lessonCorrect =
    useRef(0);

  const noteOnRef =
    useRef(onNoteOn);

  const noteOffRef =
    useRef(onNoteOff);

  const handleNoteOnRef =
    useRef(null);

  const handleNoteOffRef =
    useRef(null);

  useEffect(() => {
    noteOnRef.current =
      onNoteOn;
  }, [onNoteOn]);

  useEffect(() => {
    noteOffRef.current =
      onNoteOff;
  }, [onNoteOff]);

  const targetSignature =
    useMemo(
      () =>
        Array.isArray(targetNotes)
          ? targetNotes
              .filter((n) =>
                Number.isFinite(n)
              )
              .join(',')
          : '',
      [targetNotes]
    );

  const hasLessonTarget =
    Array.isArray(targetNotes) &&
    targetNotes.length > 0;

  useEffect(() => {
    lessonAttempts.current = 0;
    lessonCorrect.current = 0;

    if (hasLessonTarget) {
      updateAccuracy(0);
    }
  }, [
    targetSignature,
    hasLessonTarget,
    updateAccuracy,
  ]);

  useEffect(() => {
    setExpectedNote(
      expectedNoteProp ?? null
    );
  }, [
    expectedNoteProp,
    setExpectedNote,
  ]);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(
        window.innerWidth
      );
    };

    window.addEventListener(
      'resize',
      handleResize
    );

    return () => {
      window.removeEventListener(
        'resize',
        handleResize
      );
    };
  }, []);

  const analyzePerformance =
    useCallback(() => {
      if (
        playedNotes.current.length ===
        0
      ) {
        return;
      }

      /*
       * Lesson mode uses the
       * actual lesson target.
       *
       * Free practice uses a
       * rolling group of 5 notes
       * only for timing analysis.
       */
      const analysisLength =
        hasLessonTarget
          ? targetNotes.length
          : 5;

      if (
        analysisLength <= 0 ||
        playedNotes.current.length <
          analysisLength
      ) {
        return;
      }

      const notesToAnalyze =
        playedNotes.current.slice(
          -analysisLength
        );

      const startTime =
        notesToAnalyze[0]?.startTime ??
        performance.now();

      const referenceGrid =
        MIDISenseAnalysis.buildReferenceBeatGrid(
          startTime,
          120,
          analysisLength
        );

      const timingResults =
        MIDISenseAnalysis.analyzeTiming(
          notesToAnalyze,
          referenceGrid
        );

      const noteResults =
        hasLessonTarget
          ? MIDISenseAnalysis
              .analyzeNoteCorrectness(
                notesToAnalyze,
                targetNotes
              )
          : null;

      const dynamicsResults =
        MIDISenseAnalysis.analyzeDynamics(
          notesToAnalyze
        );

      const feedback =
        MIDISenseAnalysis.generateFeedback(
          timingResults.perNote,
          noteResults,
          dynamicsResults
        );

      const analysis = {
        timing: timingResults,
        noteCorrectness:
          noteResults,
        dynamics:
          dynamicsResults,
        feedback,
      };

      console.log(
        'MIDISense Analysis:',
        analysis
      );

      /*
       * LESSON MODE:
       * Accuracy = correct notes.
       */
      if (
        hasLessonTarget &&
        typeof noteResults?.accuracy ===
          'number'
      ) {
        updateAccuracy(
          noteResults.accuracy * 100
        );
      }

      /*
       * FREE PRACTICE:
       * Accuracy = timing accuracy.
       */
      if (
        !hasLessonTarget &&
        typeof timingResults?.accuracy ===
          'number'
      ) {
        updateAccuracy(
          timingResults.accuracy * 100
        );
      }

      requestRealtimeFeedback(
        analysis
      );

      /*
       * Keep a small overlap so
       * the next analysis window
       * can be formed.
       */
      playedNotes.current =
        playedNotes.current.slice(
          -Math.max(
            analysisLength - 1,
            0
          )
        );
    }, [
      hasLessonTarget,
      targetNotes,
      updateAccuracy,
      requestRealtimeFeedback,
    ]);

  const handleNoteOn =
    useCallback(
      (
        midiNote,
        velocity = 100,
        source = 'keyboard'
      ) => {
        if (
          !Number.isFinite(midiNote)
        ) {
          return;
        }

        const noteName =
          noteNameFromMidi(
            midiNote
          );

        const now =
          performance.now();

        if (!practiceStartedAt) {
          startPracticeSession();
        }

        recordPlayedNote();

        const playedNote = {
          note: midiNote,
          velocity: clamp(
            Number.isFinite(
              velocity
            )
              ? velocity
              : 100,
            1,
            127
          ),
          startTime: now,
          endTime: null,
        };

        playedNotes.current.push(
          playedNote
        );

        if (source === 'midi') {
          activePlayedMidiNotes.current.set(
            midiNote,
            playedNote
          );
        }

        /*
         * Lesson accuracy.
         */
        if (
          hasLessonTarget &&
          Number.isFinite(
            expectedNoteProp
          )
        ) {
          lessonAttempts.current +=
            1;

          if (
            midiNote ===
            expectedNoteProp
          ) {
            lessonCorrect.current +=
              1;
          }

          const accuracy =
            (lessonCorrect.current /
              lessonAttempts.current) *
            100;

          updateAccuracy(
            accuracy
          );
        }

        activateKey(midiNote);

        try {
          pianoAudio.playNote(
            noteName
          );
        } catch (error) {
          console.warn(
            'Piano audio error:',
            error
          );
        }

        if (noteOnRef.current) {
          noteOnRef.current(
            midiNote,
            noteName,
            noteName.replace(
              /[0-9]/g,
              ''
            )
          );
        }

        analyzePerformance();
      },
      [
        activateKey,
        analyzePerformance,
        expectedNoteProp,
        hasLessonTarget,
        pianoAudio,
        practiceStartedAt,
        recordPlayedNote,
        startPracticeSession,
        updateAccuracy,
      ]
    );

  const handleNoteOff =
    useCallback(
      (
        midiNote,
        source = 'keyboard'
      ) => {
        if (
          !Number.isFinite(midiNote)
        ) {
          return;
        }

        const noteName =
          noteNameFromMidi(
            midiNote
          );

        deactivateKey(
          midiNote
        );

        if (source === 'midi') {
          const capturedNote =
            activePlayedMidiNotes.current.get(
              midiNote
            );

          if (capturedNote) {
            capturedNote.endTime =
              performance.now();

            activePlayedMidiNotes.current.delete(
              midiNote
            );
          }
        }

        try {
          pianoAudio.releaseNote(
            noteName
          );
        } catch (error) {
          console.warn(
            'Piano release error:',
            error
          );
        }

        if (
          noteOffRef.current
        ) {
          noteOffRef.current(
            midiNote,
            noteName
          );
        }
      },
      [
        deactivateKey,
        pianoAudio,
      ]
    );

  useEffect(() => {
    handleNoteOnRef.current =
      handleNoteOn;

    handleNoteOffRef.current =
      handleNoteOff;
  }, [
    handleNoteOn,
    handleNoteOff,
  ]);

  useEffect(() => {
    const keyMap = new Map(
      WHITE_KEYS
        .filter(
          (item) => item.key
        )
        .map((item) => [
          item.key.toLowerCase(),
          item.note,
        ])
    );

    const pressedKeys =
      new Set();

    const isTypingTarget = (
      target
    ) => {
      if (!target) {
        return false;
      }

      const tagName =
        target.tagName?.toLowerCase();

      return (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (
      event
    ) => {
      if (
        isTypingTarget(
          event.target
        )
      ) {
        return;
      }

      if (event.repeat) {
        return;
      }

      const key =
        event.key.toLowerCase();

      const midiNote =
        keyMap.get(key);

      if (
        !Number.isFinite(
          midiNote
        )
      ) {
        return;
      }

      event.preventDefault();

      if (
        pressedKeys.has(key)
      ) {
        return;
      }

      pressedKeys.add(key);

      handleNoteOn(
        midiNote,
        100,
        'keyboard'
      );
    };

    const handleKeyUp = (
      event
    ) => {
      if (
        isTypingTarget(
          event.target
        )
      ) {
        return;
      }

      const key =
        event.key.toLowerCase();

      const midiNote =
        keyMap.get(key);

      if (
        !Number.isFinite(
          midiNote
        )
      ) {
        return;
      }

      event.preventDefault();

      pressedKeys.delete(key);

      handleNoteOff(
        midiNote,
        'keyboard'
      );
    };

    window.addEventListener(
      'keydown',
      handleKeyDown
    );

    window.addEventListener(
      'keyup',
      handleKeyUp
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      );

      window.removeEventListener(
        'keyup',
        handleKeyUp
      );
    };
  }, [
    handleNoteOn,
    handleNoteOff,
  ]);

  const handleMIDIMessage =
    useCallback((event) => {
      const data =
        event.data;

      if (
        !data ||
        data.length < 2
      ) {
        return;
      }

      const status =
        data[0] & 0xf0;

      const midiNote =
        data[1];

      const velocity =
        data[2] ?? 0;

      if (
        status === 0x90 &&
        velocity > 0
      ) {
        if (
          activeMidiNotes.current.has(
            midiNote
          )
        ) {
          return;
        }

        activeMidiNotes.current.add(
          midiNote
        );

        handleNoteOnRef.current?.(
          midiNote,
          velocity,
          'midi'
        );

        return;
      }

      if (
        status === 0x80 ||
        (
          status === 0x90 &&
          velocity === 0
        )
      ) {
        activeMidiNotes.current.delete(
          midiNote
        );

        handleNoteOffRef.current?.(
          midiNote,
          'midi'
        );
      }
    }, []);

  useEffect(() => {
    let cancelled = false;

    const setupMIDI =
      async () => {
        if (
          typeof navigator ===
            'undefined' ||
          !navigator.requestMIDIAccess
        ) {
          setMidiConnected(false);
          return;
        }

        try {
          const access =
            await navigator.requestMIDIAccess();

          if (cancelled) {
            return;
          }

          midiAccessRef.current =
            access;

          let connected = false;

          access.inputs.forEach(
            (input) => {
              input.onmidimessage =
                handleMIDIMessage;

              if (
                input.state ===
                'connected'
              ) {
                connected = true;
              }
            }
          );

          setMidiConnected(
            connected
          );

          access.onstatechange =
            () => {
              if (cancelled) {
                return;
              }

              let hasConnectedInput =
                false;

              access.inputs.forEach(
                (input) => {
                  input.onmidimessage =
                    handleMIDIMessage;

                  if (
                    input.state ===
                    'connected'
                  ) {
                    hasConnectedInput =
                      true;
                  }
                }
              );

              setMidiConnected(
                hasConnectedInput
              );
            };
        } catch (error) {
          console.warn(
            'MIDI access unavailable:',
            error
          );

          if (!cancelled) {
            setMidiConnected(
              false
            );
          }
        }
      };

    setupMIDI();

    return () => {
      cancelled = true;

      if (
        midiAccessRef.current
      ) {
        midiAccessRef.current.inputs.forEach(
          (input) => {
            input.onmidimessage =
              null;
          }
        );

        midiAccessRef.current.onstatechange =
          null;
      }

      midiAccessRef.current =
        null;

      activeMidiNotes.current.clear();
      activePlayedMidiNotes.current.clear();
    };
  }, [
    handleMIDIMessage,
    setMidiConnected,
  ]);

  const handleMouseDown =
    useCallback(
      (midiNote) => {
        handleNoteOn(
          midiNote,
          100,
          'mouse'
        );
      },
      [handleNoteOn]
    );

  const handleMouseUp =
    useCallback(
      (midiNote) => {
        handleNoteOff(
          midiNote,
          'mouse'
        );
      },
      [handleNoteOff]
    );

  const keyWidth =
    windowWidth < 700
      ? 34
      : windowWidth < 1000
      ? 40
      : 48;

  const whiteKeyHeight =
    windowWidth < 700
      ? 180
      : 220;

  const blackKeyWidth =
    keyWidth * 0.62;

  const blackKeyHeight =
    whiteKeyHeight * 0.58;

  return (
    <div className="w-full">
      <div className="relative w-full overflow-x-auto rounded-xl border border-gray-300 bg-gray-900 p-4 shadow-lg">
        <div
          className="relative mx-auto flex"
          style={{
            width:
              WHITE_KEYS.length *
              keyWidth,
            height:
              whiteKeyHeight,
          }}
        >
          {WHITE_KEYS.map(
            (key) => {
              const isActive =
                activeKeys?.has?.(
                  key.note
                ) ||
                activeKeys?.includes?.(
                  key.note
                );

              const isExpected =
                expectedNoteProp ===
                key.note;

              return (
                <button
                  key={key.note}
                  type="button"
                  onMouseDown={() =>
                    handleMouseDown(
                      key.note
                    )
                  }
                  onMouseUp={() =>
                    handleMouseUp(
                      key.note
                    )
                  }
                  onMouseLeave={() => {
                    if (
                      activeKeys?.has?.(
                        key.note
                      ) ||
                      activeKeys?.includes?.(
                        key.note
                      )
                    ) {
                      handleMouseUp(
                        key.note
                      );
                    }
                  }}
                  className={`relative flex shrink-0 items-end justify-center border border-gray-400 pb-3 text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-300'
                      : isExpected
                      ? 'bg-yellow-200'
                      : 'bg-white'
                  }`}
                  style={{
                    width: keyWidth,
                    height:
                      whiteKeyHeight,
                    color:
                      '#111827',
                  }}
                >
                  <span>
                    {key.name}
                  </span>

                  {key.key && (
                    <span className="absolute bottom-8 text-xs text-gray-500">
                      {key.key}
                    </span>
                  )}
                </button>
              );
            }
          )}

          {BLACK_KEYS.map(
            (key) => {
              const isActive =
                activeKeys?.has?.(
                  key.note
                ) ||
                activeKeys?.includes?.(
                  key.note
                );

              const isExpected =
                expectedNoteProp ===
                key.note;

              const whiteIndex =
                WHITE_KEYS.findIndex(
                  (whiteKey) =>
                    whiteKey.note ===
                    key.note - 1
                );

              const position =
                whiteIndex >= 0
                  ? (whiteIndex + 1) *
                      keyWidth -
                    blackKeyWidth / 2
                  : 0;

              return (
                <button
                  key={key.note}
                  type="button"
                  onMouseDown={() =>
                    handleMouseDown(
                      key.note
                    )
                  }
                  onMouseUp={() =>
                    handleMouseUp(
                      key.note
                    )
                  }
                  onMouseLeave={() => {
                    if (
                      activeKeys?.has?.(
                        key.note
                      ) ||
                      activeKeys?.includes?.(
                        key.note
                      )
                    ) {
                      handleMouseUp(
                        key.note
                      );
                    }
                  }}
                  className={`absolute top-0 z-10 rounded-b-md border border-gray-700 text-xs font-semibold text-white shadow-md transition-all ${
                    isActive
                      ? 'bg-blue-600'
                      : isExpected
                      ? 'bg-yellow-500'
                      : 'bg-gray-900'
                  }`}
                  style={{
                    left: position,
                    width:
                      blackKeyWidth,
                    height:
                      blackKeyHeight,
                  }}
                >
                  {key.name}
                </button>
              );
            }
          )}
        </div>
      </div>

      <div className="mt-3 text-center text-xs text-gray-500">
        Use your computer keyboard or MIDI keyboard to play.
      </div>

      {Number.isFinite(
        expectedNoteProp
      ) && (
        <div className="mt-3 text-center">
          <span className="text-sm text-gray-500">
            Expected note:{' '}
          </span>

          <span className="font-semibold text-blue-600">
            {noteNameFromMidi(
              expectedNoteProp
            )}
          </span>
        </div>
      )}
    </div>
  );
}