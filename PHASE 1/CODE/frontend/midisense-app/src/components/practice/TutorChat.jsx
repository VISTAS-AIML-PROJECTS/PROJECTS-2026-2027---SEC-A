/**
 * TutorChat.jsx
 * -------------
 * Right-side collapsible chat sidebar.
 * Messages persist via usePracticeStore → practiceService (localStorage).
 *
 * TODO: When a real AI tutor API is ready, replace the simulated delay
 *       and canned reply in usePracticeStore.sendChatMessage() with an
 *       actual API call. This component needs no changes.
 */

import { useState, useRef, useEffect } from 'react';
import usePracticeStore from '../../store/usePracticeStore';

/** Format a timestamp to a short HH:MM string */
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function TutorChat({ isOpen, onToggle }) {
  const messages    = usePracticeStore((s) => s.chatMessages);
  const chatLoading = usePracticeStore((s) => s.chatLoading);
  const sendMessage = usePracticeStore((s) => s.sendChatMessage);
  const clearChat   = usePracticeStore((s) => s.clearChat);

  const [inputText, setInputText] = useState('');
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  function handleSend() {
    const text = inputText.trim();
    if (!text || chatLoading) return;
    setInputText('');
    sendMessage(text);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* ── Toggle tab (always visible, sticks to the right edge) ── */}
      <button
        id="btn-chat-toggle"
        type="button"
        onClick={onToggle}
        className={`
          fixed top-1/2 -translate-y-1/2 z-40
          flex items-center justify-center
          w-8 h-20 rounded-l-xl
          bg-indigo-600 hover:bg-indigo-500
          text-white text-xs font-bold
          shadow-lg shadow-indigo-500/30
          transition-all duration-300
          ${isOpen ? 'right-[320px] lg:right-[360px]' : 'right-0'}
        `}
        aria-label={isOpen ? 'Close tutor chat' : 'Open tutor chat'}
        aria-expanded={isOpen}
      >
        <span
          className={`transition-transform duration-300 ${isOpen ? 'rotate-0' : 'rotate-180'}`}
          style={{ writingMode: 'vertical-rl' }}
        >
          {isOpen ? '›› Chat' : 'Chat ‹‹'}
        </span>
      </button>

      {/* ── Sidebar panel ── */}
      <aside
        className={`
          fixed top-0 right-0 bottom-0 z-30
          w-[320px] lg:w-[360px]
          flex flex-col
          bg-[#12121f] border-l border-white/8
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        aria-label="Tutor chat sidebar"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-base">
              🧠
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">AI Tutor</p>
              <p className="text-[10px] text-slate-500">Always here to help</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors px-2 py-1 rounded hover:bg-white/6"
              aria-label="Clear chat history"
            >
              Clear
            </button>
          )}
        </header>

        {/* Messages area */}
        <div
          className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          {/* Empty state */}
          {messages.length === 0 && !chatLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
              <div className="text-4xl">🎹</div>
              <p className="text-sm text-slate-400">
                Ask your AI tutor anything about what you're practicing!
              </p>
              <p className="text-xs text-slate-600">
                Try: "What notes make a C major chord?"
              </p>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Tutor avatar */}
              {msg.role === 'tutor' && (
                <div className="w-6 h-6 rounded-full bg-indigo-500/30 border border-indigo-500/40 flex items-center justify-center text-xs flex-shrink-0 mr-2 mt-0.5">
                  🧠
                </div>
              )}
              <div
                className={`
                  max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white/6 border border-white/8 text-slate-200 rounded-tl-sm'
                  }
                `}
              >
                <p>{msg.text}</p>
                <p
                  className={`text-[10px] mt-1 ${
                    msg.role === 'user' ? 'text-indigo-200 text-right' : 'text-slate-600'
                  }`}
                >
                  {formatTime(msg.ts)}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="w-6 h-6 rounded-full bg-indigo-500/30 border border-indigo-500/40 flex items-center justify-center text-xs flex-shrink-0 mr-2 mt-0.5">
                🧠
              </div>
              <div className="bg-white/6 border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-3 py-3 border-t border-white/8">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              id="chat-input"
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your tutor…"
              className="
                flex-1 resize-none
                input-field
                px-3 py-2.5 text-sm
                min-h-[40px] max-h-[120px]
                rounded-xl
              "
              style={{ overflowY: 'auto' }}
              aria-label="Chat message input"
              disabled={chatLoading}
            />
            <button
              id="btn-chat-send"
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() || chatLoading}
              className="
                flex-shrink-0 w-10 h-10 rounded-xl
                bg-indigo-600 hover:bg-indigo-500
                disabled:opacity-40 disabled:cursor-not-allowed
                text-white flex items-center justify-center
                transition-all duration-200
                shadow-md shadow-indigo-500/30
              "
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-slate-700 mt-1.5 text-center">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </aside>
    </>
  );
}
