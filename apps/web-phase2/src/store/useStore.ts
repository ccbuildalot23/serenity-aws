import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  role: 'patient' | 'provider' | 'supporter' | 'admin';
  name?: string;
}

interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  
  // Check-in state
  lastCheckIn: Date | null;
  checkInStreak: number;
  setLastCheckIn: (date: Date) => void;
  setCheckInStreak: (streak: number) => void;
  
  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  
  // Notifications
  notifications: any[];
  addNotification: (notification: any) => void;
  removeNotification: (id: string) => void;
  
  // Clear all state
  reset: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      lastCheckIn: null,
      checkInStreak: 0,
      sidebarOpen: true,
      notifications: [],

      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      logout: () => set({ user: null, isAuthenticated: false }),
      
      setLastCheckIn: (date) => set({ lastCheckIn: date }),
      
      setCheckInStreak: (streak) => set({ checkInStreak: streak }),
      
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      addNotification: (notification) =>
        set((state) => ({
          notifications: [...state.notifications, { ...notification, id: Date.now().toString() }],
        })),
      
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
      
      reset: () =>
        set({
          user: null,
          isAuthenticated: false,
          lastCheckIn: null,
          checkInStreak: 0,
          sidebarOpen: true,
          notifications: [],
        }),
    }),
    {
      name: 'serenity-phase2-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        lastCheckIn: state.lastCheckIn,
        checkInStreak: state.checkInStreak,
      }),
    }
  )
);