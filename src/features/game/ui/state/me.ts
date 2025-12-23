import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  provider: string;
  provider_id: string;
  avatar: string;
}

interface UserStore {
  user: User | null;
  hydrated: boolean;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  setHydrated: (v: boolean) => void;
}

export const useMeStore = create<UserStore>((set) => ({
  user: null,
  hydrated: false,
  setUser: (user: User | null) => set({ user }),
  clearUser: () => set({ user: null }),
  setHydrated: (v: boolean) => set({ hydrated: v }),
}));
