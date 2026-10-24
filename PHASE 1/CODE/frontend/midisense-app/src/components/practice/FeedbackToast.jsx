/**
 * FeedbackToast.jsx
 * -----------------
 * Floating feedback popups that appear when a note is "played".
 * Stacks up to 3 toasts, newest on top. Each auto-dismisses after 2.5 seconds.
 *
 * Receives toasts from usePracticeStore and handles its own mount/unmount
 * animation via CSS keyframes in index.css (toast-slide-in, toast-fade-out).
 */

import { useEffect } from 'react';
import usePracticeStore from '../../store/usePracticeStore';

const TOAST_DURATION_MS = 2500;

/** Individual toast item with auto-dismiss. */
function ToastItem({ toast }) {
  const removeToast = usePracticeStore((s) => s.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  return (
    <div
      className="toast-item glass-card px-5 py-3.5 flex items-start gap-3 max-w-sm w-full pointer-events-auto"
      role="status"
      aria-live="polite"
    >
      {/* Note badge */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
        <span className="text-sm font-bold text-indigo-300">{toast.noteName}</span>
      </div>
      {/* Message */}
      <p className="text-sm text-slate-200 leading-snug pt-0.5">{toast.message}</p>
      {/* Close button */}
      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 text-slate-600 hover:text-slate-400 transition-colors ml-auto text-lg leading-none -mt-0.5"
        aria-label="Dismiss feedback"
      >
        ×
      </button>
    </div>
  );
}

/** Container rendered at the top of PracticePage (highest z-index). */
export default function FeedbackToast() {
  const toasts = usePracticeStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 top-6 flex flex-col items-center gap-2 z-[9999] pointer-events-none px-4"
      aria-label="Feedback notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
