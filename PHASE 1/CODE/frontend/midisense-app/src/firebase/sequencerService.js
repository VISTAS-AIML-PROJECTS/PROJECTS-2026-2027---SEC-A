/**
 * sequencerService.js
 * -------------------
 * Firestore persistence layer for Sequencer projects.
 * Follows the same pattern as lessonService.js (same import style, same db ref,
 * same async/await + merge conventions).
 *
 * Firestore path: /users/{userId}/sequencer/project  (sub-document)
 *
 * Document shape:
 *   {
 *     tracks:      Track[]   // full track + note data (see useSequencerStore)
 *     tempo:       number    // BPM at time of save (informational; playback uses practiceStore)
 *     totalBars:   number    // default 8
 *     lastUpdated: number    // epoch ms
 *   }
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config';

// ── Default project ───────────────────────────────────────────────────────────

const DEFAULT_PROJECT = {
  tracks:      [],
  tempo:       90,
  totalBars:   8,
  loopEnabled: false,
  loopStart:   0,
  loopEnd:     8,
  lastUpdated: 0,
};

// ── Load ──────────────────────────────────────────────────────────────────────

/**
 * Load the saved sequencer project for a user.
 * Returns a default empty project if none has been saved yet.
 *
 * @param {string} userId  — Firebase Auth UID
 * @returns {Promise<{ tracks: object[], tempo: number, totalBars: number }>}
 */
export async function loadProject(userId) {
  const ref  = doc(db, 'users', userId, 'sequencer', 'project');
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    return {
      tracks:      Array.isArray(data.tracks) ? data.tracks : [],
      tempo:       typeof data.tempo    === 'number' ? data.tempo    : 90,
      totalBars:   typeof data.totalBars === 'number' ? data.totalBars : 8,
      loopEnabled: typeof data.loopEnabled === 'boolean' ? data.loopEnabled : false,
      loopStart:   typeof data.loopStart   === 'number'  ? data.loopStart   : 0,
      loopEnd:     typeof data.loopEnd     === 'number'  ? data.loopEnd     : 8,
    };
  }
  return { ...DEFAULT_PROJECT };
}

// ── Save ──────────────────────────────────────────────────────────────────────

/**
 * Save the current sequencer project for a user.
 * Uses merge:true so partial saves don't wipe unrelated sub-documents.
 *
 * @param {string} userId   — Firebase Auth UID
 * @param {{ tracks: object[], tempo: number, totalBars: number }} project
 * @returns {Promise<void>}
 */
export async function saveProject(userId, project) {
  const ref = doc(db, 'users', userId, 'sequencer', 'project');
  await setDoc(
    ref,
    {
      tracks:      project.tracks      ?? [],
      tempo:       project.tempo       ?? 90,
      totalBars:   project.totalBars   ?? 8,
      loopEnabled: project.loopEnabled ?? false,
      loopStart:   project.loopStart   ?? 0,
      loopEnd:     project.loopEnd     ?? 8,
      lastUpdated: Date.now(),
    },
    { merge: true },
  );
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Wipe the saved project for a user (useful for "new project" / testing).
 *
 * @param {string} userId — Firebase Auth UID
 * @returns {Promise<void>}
 */
export async function deleteProject(userId) {
  const ref = doc(db, 'users', userId, 'sequencer', 'project');
  await setDoc(ref, { ...DEFAULT_PROJECT, lastUpdated: Date.now() });
}
