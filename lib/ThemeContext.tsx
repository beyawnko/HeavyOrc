import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeName = 'forest' | 'desert' | 'ocean' | 'midnight';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return 'forest';
    const storedTheme = localStorage.getItem('heavyorc-theme');
    const isValidTheme = (t: string | null): t is ThemeName => ['forest', 'desert', 'ocean', 'midnight'].includes(t ?? '');
    return isValidTheme(storedTheme) ? storedTheme : 'forest';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('heavyorc-theme', theme);
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

