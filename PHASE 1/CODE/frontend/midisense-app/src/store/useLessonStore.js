/**
 * useLessonStore.js
 * -----------------
 * Zustand store for lesson progress state.
 * Mirrors the same create() pattern used by usePracticeStore.js and
 * useAuthStore.js — no subscribeWithSelector, same simple slice style.
 *
 * State:
 *   completedIds  — Set<string> of lesson IDs the user has finished
 *   loading       — true while fetching progress from Firestore
 *   error         — string | null for any fetch/write error
 *
 * Actions:
 *   fetchProgress(uid)           — loads from Firestore, populates completedIds
 *   completeLesson(uid, id)      — marks lesson done in Firestore + local state
 *   isCompleted(id)              — helper: returns boolean
 *   isUnlocked(id, orderedIds)   — helper: true if previous lesson is complete
 *                                   (first lesson is always unlocked)
 */

import { create } from 'zustand';
import { getLessonProgress, markLessonComplete } from '../firebase/lessonService';
import { LESSONS } from '../data/lessons';

const LOCAL_STORAGE_KEY = 'midisense_completed_lessons';

function getLocalCompleted() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalCompleted(idsSet) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...idsSet]));
  } catch (e) {
    // ignore
  }
}

// Map of first lesson ID per unit
const FIRST_LESSON_IN_UNIT = new Set(
  LESSONS.reduce((acc, l) => {
    if (!acc.some((x) => l.unitId === x.unitId)) acc.push(l);
    return acc;
  }, []).map((l) => l.id)
);

const useLessonStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  completedIds: new Set(getLocalCompleted()),
  loading: false,
  error: null,

  // ── Fetch from Firestore ───────────────────────────────────────────────────
  fetchProgress: async (uid) => {
    const localList = getLocalCompleted();
    if (!uid) {
      set({ completedIds: new Set(localList) });
      return;
    }
    set({ loading: true, error: null });
    try {
      const progress = await getLessonProgress(uid);
      const merged = new Set([...localList, ...(progress.completedIds || [])]);
      saveLocalCompleted(merged);
      set({ completedIds: merged, loading: false });
    } catch (err) {
      console.error('[useLessonStore] fetchProgress error:', err);
      set({ completedIds: new Set(localList), loading: false });
    }
  },

  // ── Mark lesson complete ───────────────────────────────────────────────────
  completeLesson: async (uid, lessonId) => {
    if (!lessonId) return;
    const prev = get().completedIds;
    const next = new Set([...prev, lessonId]);
    saveLocalCompleted(next);
    set({ completedIds: next });

    if (uid) {
      try {
        await markLessonComplete(uid, lessonId);
      } catch (err) {
        console.error('[useLessonStore] markLessonComplete remote save warning:', err);
      }
    }
  },

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** @param {string} lessonId */
  isCompleted: (lessonId) => get().completedIds.has(lessonId),

  /**
   * A lesson is unlocked if:
   * 1. It is the first lesson in the curriculum.
   * 2. It is the first lesson of any Unit.
   * 3. The immediately preceding lesson in sequence is completed.
   *
   * @param {string}   lessonId    — lesson to check
   * @param {string[]} orderedIds  — flat ordered array from getOrderedLessonIds()
   */
  isUnlocked: (lessonId, orderedIds) => {
    const idx = orderedIds.indexOf(lessonId);
    if (idx <= 0) return true;
    if (FIRST_LESSON_IN_UNIT.has(lessonId)) return true;
    const prevId = orderedIds[idx - 1];
    return get().completedIds.has(prevId);
  },
}));

export default useLessonStore;

