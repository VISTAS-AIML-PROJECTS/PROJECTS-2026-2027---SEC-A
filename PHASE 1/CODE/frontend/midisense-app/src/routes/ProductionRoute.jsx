import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import useAuthStore from '../store/useAuthStore';
import { getUserProfile } from '../firebase/firestore';

export default function ProductionRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    if (!user) {
      setAllowed(false);
      return;
    }

    getUserProfile(user.uid).then((profile) => {
      const mode = profile?.mode ?? 'learning';
      const level = profile?.skillLevel ?? 'Beginner';

      setAllowed(
        mode === 'production' ||
        level !== 'Beginner' ||
        profile?.assessmentPassed === true
    );
    });
  }, [user]);

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a]">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return allowed ? children : <Navigate to="/dashboard" replace />;
}