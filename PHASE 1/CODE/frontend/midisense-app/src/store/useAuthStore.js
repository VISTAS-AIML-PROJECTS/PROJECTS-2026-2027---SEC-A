import { create } from 'zustand';

function getInitialUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('midisense_qa_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const initialUser = getInitialUser();

const useAuthStore = create((set) => ({
  user: initialUser,
  loading: initialUser ? false : true,

  setUser: (user) => {
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      if (user) localStorage.setItem('midisense_qa_user', JSON.stringify(user));
      else localStorage.removeItem('midisense_qa_user');
    }
    set({ user, loading: false });
  },
  clearUser: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('midisense_qa_user');
    }
    set({ user: null, loading: false });
  },
  setLoading: (loading) => set({ loading }),
}));

export default useAuthStore;
