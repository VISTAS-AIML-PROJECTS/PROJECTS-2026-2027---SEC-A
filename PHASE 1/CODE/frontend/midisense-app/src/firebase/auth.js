import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from './config';

const googleProvider = new GoogleAuthProvider();

/**
 * Sign up a new user with email + password.
 * Sets displayName to the part of the email before '@'.
 */
export async function signUpWithEmail(email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const displayName = email.split('@')[0];
  await updateProfile(credential.user, { displayName });
  return credential.user;
}

/**
 * Sign in an existing user with email + password.
 */
export async function signInWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Sign in (or sign up) using Google popup.
 */
export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

/**
 * Sign out the current user.
 */
export async function signOutUser() {
  await signOut(auth);
}
