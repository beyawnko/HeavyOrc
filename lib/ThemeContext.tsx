import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeName = 'forest' | 'desert' | 'ocean' | 'midnight';

const THEME_STORAGE_KEY = 'heavyorc-theme';
const THEMES: readonly ThemeName[] = ['forest', 'desert', 'ocean', 'midnight'];

const isValidTheme = (t: string | null): t is ThemeName =>
  !!t && (THEMES as readonly string[]).includes(t);

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return 'forest';
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      return isValidTheme(storedTheme) ? storedTheme : 'forest';
    } catch (e) {
      console.warn('Failed to read theme from localStorage', e);
      return 'forest';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      console.warn('Failed to save theme to localStorage', e);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

