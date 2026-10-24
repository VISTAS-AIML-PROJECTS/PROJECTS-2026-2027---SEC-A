/**
 * lessonService.js
 * ----------------
 * Firestore persistence layer for lesson progress.
 * Follows the same pattern as firestore.js (same import style, same db ref,
 * same async/await + merge conventions).
 *
 * Firestore path: /users/{userId}/lessonProgress  (sub-document)
 *
 * Document shape:
 *   {
 *     completedIds: string[]   // array of completed lesson IDs
 *     lastUpdated:  number     // epoch ms of last write
 *   }
 */

import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from './config';

// ── Lesson Progress ──────────────────────────────────────────────────────────

/**
 * Load the lesson progress document for a user.
 * Returns { completedIds: string[] } or a default object if none exists.
 *
 * @param {string} userId  — Firebase Auth UID
 * @returns {Promise<{ completedIds: string[] }>}
 */
export async function getLessonProgress(userId) {
  try {
    const ref  = doc(db, 'users', userId, 'progress', 'lessonProgress');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        completedIds: Array.isArray(data.completedIds) ? data.completedIds : [],
      };
    }
    return { completedIds: [] };
  } catch (err) {
    console.warn('getLessonProgress handled:', err?.message);
    return { completedIds: [] };
  }
}

/**
 * Mark a single lesson as complete for a user.
 * Uses arrayUnion so it is safe to call multiple times (idempotent).
 *
 * @param {string} userId    — Firebase Auth UID
 * @param {string} lessonId  — Lesson ID (e.g. 'intro-to-keyboard')
 * @returns {Promise<void>}
 */
export async function markLessonComplete(userId, lessonId) {
  const ref = doc(db, 'users', userId, 'progress', 'lessonProgress');
  await setDoc(
    ref,
    {
      completedIds: arrayUnion(lessonId),
      lastUpdated: Date.now(),
    },
    { merge: true },
  );
}

/**
 * Reset all lesson progress for a user (useful for testing / "restart course").
 *
 * @param {string} userId — Firebase Auth UID
 * @returns {Promise<void>}
 */
export async function resetLessonProgress(userId) {
  const ref = doc(db, 'users', userId, 'progress', 'lessonProgress');
  await setDoc(ref, { completedIds: [], lastUpdated: Date.now() });
}
