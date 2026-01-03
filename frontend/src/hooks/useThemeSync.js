/**
 * useThemeSync hook - Manages theme synchronization between local storage and backend
 */
import { useEffect, useRef } from 'react';
import { useUIStore } from '../store';

export function useThemeSync(user, isAuthenticated, isGuest, updateProfile) {
  const { theme, setTheme } = useUIStore();
  const themeSyncedRef = useRef(false);
  const lastSyncedTheme = useRef(null);

  // Sync theme from user profile on initial login
  useEffect(() => {
    if (user?.theme && !themeSyncedRef.current) {
      try {
        const storedData = localStorage.getItem('magentic-ui-storage');
        if (storedData) {
          const parsed = JSON.parse(storedData);
          if (parsed?.state?.theme) {
            themeSyncedRef.current = true;
            return;
          }
        }
      } catch (e) {
        // ignore
      }
      setTheme(user.theme);
      themeSyncedRef.current = true;
    }
  }, [user?.theme, setTheme]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  
  // Sync theme changes to backend (debounced)
  useEffect(() => {
    if (isAuthenticated && !isGuest && theme && theme !== lastSyncedTheme.current) {
      lastSyncedTheme.current = theme;
      const timer = setTimeout(() => {
        updateProfile({ theme }).catch(() => {
          // Ignore errors - local storage is the primary source
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [theme, isAuthenticated, isGuest, updateProfile]);

  return { theme, setTheme };
}
