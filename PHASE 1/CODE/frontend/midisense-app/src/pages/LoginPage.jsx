import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signUpWithEmail, signInWithEmail, signInWithGoogle } from '../firebase/auth';
import { hasCompletedOnboarding } from '../firebase/firestore';
import useAuthStore from '../store/useAuthStore';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

// ── Validation helpers ────────────────────────────────────────────────────────
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
function validatePassword(pw) {
  return pw.length >= 6;
}

// ── Google logo SVG ───────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate  = useNavigate();
  const setUser   = useAuthStore((s) => s.setUser);

  const [mode, setMode]         = useState('login'); // 'login' | 'signup'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors]     = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading]   = useState(false);

  function validate() {
    const e = {};
    if (!validateEmail(email))    e.email    = 'Please enter a valid email address.';
    if (!validatePassword(password)) e.password = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleAfterAuth(user) {
    setUser(user);
    // Wrap in try/catch — if Firestore rules block the read (e.g. during
    // setup), we still navigate safely instead of showing an error.
    try {
      const done = await hasCompletedOnboarding(user.uid);
      navigate(done ? '/dashboard' : '/onboarding', { replace: true });
    } catch {
      // Firestore not yet set up or rules blocking — send to onboarding
      navigate('/onboarding', { replace: true });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setServerError('');
    setLoading(true);
    try {
      const user =
        mode === 'signup'
          ? await signUpWithEmail(email, password)
          : await signInWithEmail(email, password);
      await handleAfterAuth(user);
    } catch (err) {
      setServerError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setServerError('');
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      await handleAfterAuth(user);
    } catch (err) {
      setServerError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setErrors({});
    setServerError('');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
         style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(99,102,241,0.18) 0%, transparent 60%), #0f0f1a' }}>

      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-500/30 text-3xl">
            🎹
          </div>
          <h1 className="text-3xl font-extrabold gradient-text">MIDISense</h1>
          <p className="text-slate-400 text-sm">
            {mode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create your account and start playing.'}
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8 space-y-6">
          {/* Mode toggle */}
          <div className="flex bg-white/6 rounded-xl p-1 gap-1">
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m) || setErrors({}) || setServerError('')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  mode === m
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Google button */}
          <Button
            variant="google"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full"
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-slate-500">or with email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
            />
            <Input
              id="password"
              label="Password"
              type="password"
              placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />

            {serverError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                {serverError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full py-3.5"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={toggleMode} className="text-indigo-400 hover:text-indigo-300 font-medium">
            {mode === 'login' ? 'Sign up free' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Firebase error → readable message ────────────────────────────────────────
function friendlyError(code) {
  const map = {
    // Auth errors
    'auth/user-not-found':          'No account found with that email.',
    'auth/wrong-password':          'Incorrect password. Please try again.',
    'auth/email-already-in-use':    'An account with this email already exists.',
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/too-many-requests':       'Too many attempts. Please wait a moment and try again.',
    'auth/popup-closed-by-user':    'Google sign-in was cancelled.',
    'auth/invalid-credential':      'Incorrect email or password.',
    'auth/user-disabled':           'This account has been disabled.',
    'auth/network-request-failed':  'Network error — check your internet connection.',
    'auth/internal-error':          'Firebase internal error. Check that Auth is enabled in your Firebase Console.',
    // This fires when Email/Password or Google is NOT enabled in Firebase Console
    'auth/operation-not-allowed':
      '⚠️ This sign-in method is not enabled. Go to Firebase Console → Authentication → Sign-in method and enable Email/Password (and Google if needed).',
    // Firestore / config errors
    'auth/app-not-authorized':
      '⚠️ App not authorized. Check your Firebase project config in .env.',
    'auth/configuration-not-found':
      '⚠️ Firebase Auth is not configured. Make sure your .env values are correct and Auth is enabled in Firebase Console.',
  };

  // In development, always show the raw code so you know exactly what Firebase returned
  const friendly = map[code];
  if (!friendly) {
    return `Something went wrong (${code ?? 'unknown error'}). Open the browser console for details.`;
  }
  return friendly;
}
