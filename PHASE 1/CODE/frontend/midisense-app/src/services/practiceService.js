/**
 * practiceService.js
 * ------------------
 * Mock persistence layer for the Practice page using localStorage.
 * Mirrors the same pattern as authService.js.
 *
 * Keys stored:
 *   ms_chat_history   — Array of chat message objects
 *   ms_tempo          — Number (BPM)
 */

const KEYS = {
  CHAT_HISTORY: 'ms_chat_history',
  TEMPO: 'ms_tempo',
};

// ── Chat history ────────────────────────────────────────────────────────────

/** @returns {Array<{id:string, role:'user'|'tutor', text:string, ts:number}>} */
export function loadChatHistory() {
  try {
    const raw = localStorage.getItem(KEYS.CHAT_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** @param {Array} messages */
export function saveChatHistory(messages) {
  try {
    localStorage.setItem(KEYS.CHAT_HISTORY, JSON.stringify(messages));
  } catch {
    // localStorage quota exceeded or unavailable — fail silently
  }
}

export function clearChatHistory() {
  localStorage.removeItem(KEYS.CHAT_HISTORY);
}

// ── Tempo ───────────────────────────────────────────────────────────────────

/** @returns {number} BPM (defaults to 90) */
export function loadTempo() {
  const raw = localStorage.getItem(KEYS.TEMPO);
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 90;
}

/** @param {number} bpm */
export function saveTempo(bpm) {
  localStorage.setItem(KEYS.TEMPO, String(bpm));
}
