import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

/**
 * Wraps routes that require the user to be authenticated.
 * Shows a loading spinner while Firebase resolves the session,
 * then redirects to /login if unauthenticated.
 */
export default function ProtectedRoute({ children }) {
  const user    = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
