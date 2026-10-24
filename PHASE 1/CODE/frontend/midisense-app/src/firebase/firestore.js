import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './config';

/**
 * Save (or overwrite) the full user profile to /users/{userId}.
 */
export async function saveUserProfile(userId, profileData) {
  const ref = doc(db, 'users', userId);
  await setDoc(ref, profileData, { merge: true });
}

/**
 * Retrieve the user profile document from Firestore.
 * Returns the data object, or null if the document doesn't exist.
 */
export async function getUserProfile(userId) {
  try {
    const ref  = doc(db, 'users', userId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn('getUserProfile handled:', err?.message);
    return null;
  }
}

/**
 * Returns true if the user has previously completed onboarding.
 */
export async function hasCompletedOnboarding(userId) {
  const profile = await getUserProfile(userId);
  return Boolean(profile?.onboardingComplete);
}
