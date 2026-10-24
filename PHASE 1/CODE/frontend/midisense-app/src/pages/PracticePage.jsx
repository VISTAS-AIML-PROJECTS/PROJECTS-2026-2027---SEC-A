/**
 * PracticePage.jsx
 * ----------------
 * Main practice page at /practice route.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import usePracticeStore from '../store/usePracticeStore';
import { signOutUser } from '../firebase/auth';

import SessionControls from '../components/practice/SessionControls';
import MidiStatus from '../components/practice/MidiStatus';
import PianoKeyboard from '../components/practice/PianoKeyboard';
import TutorChat from '../components/practice/TutorChat';
import FeedbackToast from '../components/practice/FeedbackToast';
import useMetronomeAudio from '../audio/useMetronomeAudio';

export default function PracticePage() {
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);

  const performanceStats = usePracticeStore(
    (s) => s.performanceStats
  );

  const updateSessionTime = usePracticeStore(
    (s) => s.updateSessionTime
  );

  const [chatOpen, setChatOpen] = useState(true);

  useMetronomeAudio();

  // Update session time every second
  useEffect(() => {
    const timer = setInterval(() => {
      updateSessionTime();
    }, 1000);

    return () => clearInterval(timer);
  }, [updateSessionTime]);

  const displayName =
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Musician';

  async function handleSignOut() {
    await signOutUser();
    clearUser();
    navigate('/login', { replace: true });
  }

  // Convert seconds → MM:SS
  const minutes = Math.floor(
    performanceStats.sessionTime / 60
  );

  const seconds = performanceStats.sessionTime % 60;

  const sessionTime =
    `${String(minutes).padStart(2, '0')}:` +
    `${String(seconds).padStart(2, '0')}`;

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.12) 0%, transparent 50%), ' +
          'radial-gradient(ellipse at 80% 100%, rgba(167,139,250,0.08) 0%, transparent 50%), ' +
          '#0f0f1a',
      }}
    >
      <FeedbackToast />

      {/* Top bar */}
      <header
        className={`
          flex-shrink-0 flex items-center justify-between
          px-4 sm:px-6 py-3
          border-b border-white/6
          bg-black/20 backdrop-blur-sm
          z-20
          transition-all duration-300
          ${chatOpen ? 'mr-[320px] lg:mr-[360px]' : 'mr-0'}
        `}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate('/dashboard')}
            role="link"
            tabIndex={0}
            onKeyDown={(e) =>
              e.key === 'Enter' && navigate('/dashboard')
            }
            aria-label="Go to dashboard"
          >
            <span className="text-xl">🎹</span>
            <span className="font-bold text-slate-200 text-base hidden sm:block">
              MIDISense
            </span>
          </div>

          <div className="hidden sm:block w-px h-5 bg-white/10" />

          <SessionControls />
        </div>

        <div className="flex items-center gap-3">
          <MidiStatus />

          <div className="hidden sm:block w-px h-5 bg-white/10" />

          <div className="flex items-center gap-2">
            <span className="hidden md:block text-xs text-slate-500 max-w-[120px] truncate">
              {displayName}
            </span>

            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-slate-400 hover:text-slate-200 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main area */}
      <main
        className={`
          flex-1 flex flex-col overflow-y-auto
          transition-all duration-300
          ${chatOpen ? 'mr-[320px] lg:mr-[360px]' : 'mr-0'}
        `}
        aria-label="Practice workspace"
      >
        {/* Welcome */}
        <div className="px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100">
              Practice Session
            </h1>

            <p className="text-sm text-slate-500 mt-0.5">
              Click any key on the keyboard below to start practicing.
            </p>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-6">
          <div className="w-full max-w-4xl glass-card p-6 space-y-4">

            {/* Hint */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-base">
                💡
              </div>

              <div>
                <p className="text-sm font-semibold text-amber-300">
                  Getting Started
                </p>

                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Use the piano keyboard at the bottom to play notes.
                  Toggle{' '}
                  <span className="text-slate-300 font-medium">
                    Recording
                  </span>{' '}
                  to mark your session, or switch on the{' '}
                  <span className="text-slate-300 font-medium">
                    Metronome
                  </span>{' '}
                  to keep time. Open the{' '}
                  <span className="text-indigo-400 font-medium">
                    Chat
                  </span>{' '}
                  sidebar on the right to talk with your AI tutor.
                </p>
              </div>
            </div>

            {/* Live stats */}
            <div className="grid grid-cols-3 gap-3 pt-2">

              <div className="glass-card p-3 text-center">
                <div className="text-lg mb-1">🎵</div>

                <p className="text-lg font-bold text-slate-200">
                  {performanceStats.notesPlayed}
                </p>

                <p className="text-[10px] text-slate-500">
                  Notes Played
                </p>
              </div>

              <div className="glass-card p-3 text-center">
                <div className="text-lg mb-1">🎯</div>

                <p className="text-lg font-bold text-slate-200">
                  {performanceStats.accuracy}%
                </p>

                <p className="text-[10px] text-slate-500">
                  Accuracy
                </p>
              </div>

              <div className="glass-card p-3 text-center">
                <div className="text-lg mb-1">⏱️</div>

                <p className="text-lg font-bold text-slate-200">
                  {sessionTime}
                </p>

                <p className="text-[10px] text-slate-500">
                  Session Time
                </p>
              </div>

            </div>

            <p className="text-[11px] text-slate-700 text-center pt-1">
              Live performance statistics update while you play.
            </p>
          </div>
        </div>

        {/* Piano keyboard */}
        <div
          className="flex-shrink-0 px-2 sm:px-4 pb-4"
          aria-label="Piano keyboard section"
        >
          <div className="glass-card p-3 sm:p-4">

            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                Keyboard
              </p>

              <p className="text-[10px] text-slate-700">
                Click any key · Ctrl+M to toggle MIDI sim
              </p>
            </div>

            <PianoKeyboard />

          </div>
        </div>
      </main>

      {/* Tutor chat */}
      <TutorChat
        isOpen={chatOpen}
        onToggle={() => setChatOpen((v) => !v)}
      />
    </div>
  );
}