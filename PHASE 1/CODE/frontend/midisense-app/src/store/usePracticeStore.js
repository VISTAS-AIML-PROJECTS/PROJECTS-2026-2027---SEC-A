/**
 * usePracticeStore.js
 * -------------------
 * Shared Practice page state.
 */

import { create } from 'zustand';

import {
  loadChatHistory,
  saveChatHistory,
  loadTempo,
  saveTempo,
} from '../services/practiceService';

const TUTOR_API =
  'http://localhost:8000';

const REALTIME_COOLDOWN = 2000;

const usePracticeStore = create(
  (set, get) => ({
    // ── MIDI ───────────────────────────────────────────────────────────────────

    midiConnected: false,

    midiDeviceName: '',

    setMidiConnected: (
      connected,
      name = ''
    ) =>
      set({
        midiConnected: connected,
        midiDeviceName: name,
      }),

    toggleMidiConnected: () =>
      set((s) => ({
        midiConnected:
          !s.midiConnected,
      })),

    // ── Session ────────────────────────────────────────────────────────────────

    isRecording: false,

    toggleRecording: () =>
      set((s) => ({
        isRecording:
          !s.isRecording,
      })),

    metronomeOn: false,

    toggleMetronome: () =>
      set((s) => ({
        metronomeOn:
          !s.metronomeOn,
      })),

    tempo: loadTempo(),

    setTempo: (bpm) => {
      const clamped = Math.min(
        300,
        Math.max(20, bpm)
      );

      saveTempo(clamped);

      set({
        tempo: clamped,
      });
    },

    incrementTempo: () => {
      const {
        tempo,
        setTempo,
      } = get();

      setTempo(tempo + 1);
    },

    decrementTempo: () => {
      const {
        tempo,
        setTempo,
      } = get();

      setTempo(tempo - 1);
    },

    // ── Live performance statistics ───────────────────────────────────────────

    performanceStats: {
      notesPlayed: 0,
      accuracy: 0,
      sessionTime: 0,
    },

    practiceStartedAt: null,

    startPracticeSession: () => {
      set({
        practiceStartedAt:
          Date.now(),

        performanceStats: {
          notesPlayed: 0,
          accuracy: 0,
          sessionTime: 0,
        },
      });
    },

    recordPlayedNote: () =>
      set((s) => ({
        performanceStats: {
          ...s.performanceStats,

          notesPlayed:
            s.performanceStats
              .notesPlayed + 1,
        },
      })),

    updateAccuracy: (accuracy) =>
      set((s) => ({
        performanceStats: {
          ...s.performanceStats,

          accuracy: Math.round(
            Math.max(
              0,
              Math.min(
                100,
                accuracy
              )
            )
          ),
        },
      })),

    updateSessionTime: () =>
      set((s) => {
        if (
          !s.practiceStartedAt
        ) {
          return s;
        }

        const elapsed =
          Math.floor(
            (Date.now() -
              s.practiceStartedAt) /
              1000
          );

        return {
          performanceStats: {
            ...s.performanceStats,

            sessionTime:
              elapsed,
          },
        };
      }),

    resetPerformanceStats: () =>
      set({
        practiceStartedAt:
          null,

        performanceStats: {
          notesPlayed: 0,
          accuracy: 0,
          sessionTime: 0,
        },
      }),

    // ── AI realtime tutor ──────────────────────────────────────────────────────

    realtimeTutorFeedback: '',

    lastRealtimeTutorAt: 0,

    requestRealtimeFeedback:
      async (analysis) => {
        const now = Date.now();

        if (
          now -
            get()
              .lastRealtimeTutorAt <
          REALTIME_COOLDOWN
        ) {
          return;
        }

        set({
          lastRealtimeTutorAt:
            now,
        });

        try {
          const response =
            await fetch(
              `${TUTOR_API}/realtime`,
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                body: JSON.stringify({
                  analysis,
                }),
              }
            );

          if (!response.ok) {
            throw new Error(
              `Realtime Tutor API error: ${response.status}`
            );
          }

          const data =
            await response.json();

          const feedback =
            data.feedback?.trim();

          if (!feedback) {
            return;
          }

          const tutorMsg = {
            id: `realtime-${Date.now()}-${Math.random()}`,
            role: 'tutor',
            text: feedback,
            ts: Date.now(),
          };

          const updatedMessages = [
            ...get()
              .chatMessages,
            tutorMsg,
          ];

          saveChatHistory(
            updatedMessages
          );

          set({
            realtimeTutorFeedback:
              feedback,

            chatMessages:
              updatedMessages,
          });
        } catch (error) {
          console.error(
            'Realtime AI Tutor error:',
            error
          );
        }
      },

    clearRealtimeFeedback: () =>
      set({
        realtimeTutorFeedback:
          '',
      }),

    // ── Piano keys ─────────────────────────────────────────────────────────────

    activeKeys: new Set(),

    expectedNote: null,

    setExpectedNote: (
      midiNote
    ) =>
      set({
        expectedNote:
          midiNote,
      }),

    activateKey: (
      midiNote
    ) =>
      set((s) => ({
        activeKeys: new Set([
          ...s.activeKeys,
          midiNote,
        ]),
      })),

    deactivateKey: (
      midiNote
    ) =>
      set((s) => {
        const next =
          new Set(
            s.activeKeys
          );

        next.delete(
          midiNote
        );

        return {
          activeKeys: next,
        };
      }),

    // ── Toasts ─────────────────────────────────────────────────────────────────

    toasts: [],

    addToast: (toast) =>
      set((s) => {
        const id =
          toast.id ||
          `toast-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

        const newToast = {
          ...toast,
          id,
        };

        return {
          toasts: [
            newToast,
            ...s.toasts,
          ].slice(0, 3),
        };
      }),

    removeToast: (id) =>
      set((s) => ({
        toasts:
          s.toasts.filter(
            (t) => t.id !== id
          ),
      })),

    // ── Tutor chat ─────────────────────────────────────────────────────────────

    chatMessages:
      loadChatHistory(),

    chatLoading: false,

    sendChatMessage:
      async (text) => {
        const cleanText =
          text.trim();

        if (
          !cleanText ||
          get().chatLoading
        ) {
          return;
        }

        const {
          chatMessages,
          performanceStats,
        } = get();

        const userMsg = {
          id: `msg-${Date.now()}-${Math.random()}`,
          role: 'user',
          text: cleanText,
          ts: Date.now(),
        };

        const updated = [
          ...chatMessages,
          userMsg,
        ];

        saveChatHistory(
          updated
        );

        set({
          chatMessages:
            updated,
          chatLoading: true,
        });

        try {
          const response =
            await fetch(
              `${TUTOR_API}/ask`,
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                body: JSON.stringify({
                  session_data: {
                    notesPlayed:
                      performanceStats.notesPlayed,

                    accuracy:
                      performanceStats.accuracy,

                    sessionTime:
                      performanceStats.sessionTime,
                  },

                  question:
                    cleanText,
                }),
              }
            );

          if (!response.ok) {
            throw new Error(
              `Tutor API error: ${response.status}`
            );
          }

          const data =
            await response.json();

          const tutorText =
            data.answer ||
            'I could not generate a tutor response.';

          const tutorMsg = {
            id: `msg-${Date.now()}-${Math.random()}`,
            role: 'tutor',
            text: tutorText,
            ts: Date.now(),
          };

          const withReply = [
            ...get()
              .chatMessages,
            tutorMsg,
          ];

          saveChatHistory(
            withReply
          );

          set({
            chatMessages:
              withReply,
            chatLoading: false,
          });
        } catch (error) {
          console.error(
            'AI Tutor error:',
            error
          );

          const errorMsg = {
            id: `msg-${Date.now()}-${Math.random()}`,
            role: 'tutor',
            text:
              'AI Tutor is currently unavailable. Please make sure the MIDISense tutor server and Ollama are running.',
            ts: Date.now(),
          };

          const withError = [
            ...get()
              .chatMessages,
            errorMsg,
          ];

          saveChatHistory(
            withError
          );

          set({
            chatMessages:
              withError,
            chatLoading: false,
          });
        }
      },

    clearChat: () => {
      saveChatHistory([]);

      set({
        chatMessages: [],
      });
    },
  })
);

export default usePracticeStore;