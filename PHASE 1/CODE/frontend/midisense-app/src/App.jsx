import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import useAuthStore from './store/useAuthStore';

import ProtectedRoute      from './routes/ProtectedRoute';
import ProductionRoute     from './routes/ProductionRoute';
import LoginPage           from './pages/LoginPage';
import OnboardingPage      from './pages/OnboardingPage';
import HomePage            from './pages/HomePage';
import PracticePage        from './pages/PracticePage';
import LessonsPage         from './pages/LessonsPage';
import LessonDetailPage    from './pages/LessonDetailPage';
import SequencerPage       from './pages/SequencerPage';
import AssessmentPage      from './pages/AssessmentPage';

export default function App() {
  const setUser   = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    window.__useAuthStore = useAuthStore;
  }

  // ── Listen to Firebase auth state throughout the session ─────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        const qaUser = typeof window !== 'undefined' && localStorage.getItem('midisense_qa_user');
        if (!qaUser) {
          clearUser();
        }
      }
    });
    return () => unsubscribe();
  }, [setUser, clearUser]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice"
          element={
            <ProtectedRoute>
              <PracticePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lessons"
          element={
            <ProtectedRoute>
              <LessonsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessment"
          element={
            <ProtectedRoute>
              <AssessmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lessons/:lessonId"
          element={
            <ProtectedRoute>
              <LessonDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/sequencer"
          element={
            <ProtectedRoute>
              <ProductionRoute>
                <SequencerPage />
              </ProductionRoute>
            </ProtectedRoute>
          }
        />

        {/* Fallback → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
