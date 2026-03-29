import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState('system');
  const [primaryColor, setPrimaryColor] = useState('#0055bb');
  const [fontSize, setFontSize] = useState(14);

  const applyTheme = useCallback((nextTheme, nextColor, nextFontSize) => {
    if (typeof document === 'undefined') {
      return;
    }

    const resolvedTheme =
      nextTheme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : nextTheme;
    const safeColor = normalizeHexColor(nextColor, '#0055bb');
    const safeFontSize = Number.isFinite(Number(nextFontSize)) ? Number(nextFontSize) : 14;

    document.documentElement.setAttribute('data-theme', nextTheme);
    document.documentElement.setAttribute('data-resolved-theme', resolvedTheme);
    document.documentElement.style.setProperty('--primary', safeColor);
    document.documentElement.style.setProperty('--primary-hover', adjustColor(safeColor, -15));
    document.documentElement.style.fontSize = `${safeFontSize}px`;

    setTheme(nextTheme);
    setPrimaryColor(safeColor);
    setFontSize(safeFontSize);
  }, []);

  const loadTheme = useCallback(async () => {
    if (!user) {
      applyTheme('system', '#0055bb', 14);
      return;
    }

    const { data, error } = await supabase
      .from('appearance_settings')
      .select('theme, primary_color, font_size')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      applyTheme(
        data.theme || 'system',
        data.primary_color || '#0055bb',
        data.font_size || 14
      );
      return;
    }

    applyTheme('system', '#0055bb', 14);
  }, [applyTheme, user]);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme(theme, primaryColor, fontSize);
      }
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [applyTheme, fontSize, primaryColor, theme]);

  return (
    <ThemeContext.Provider value={{ theme, primaryColor, fontSize, reloadTheme: loadTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

function adjustColor(hex, amount) {
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch {
    return hex;
  }
}

function normalizeHexColor(value, fallback) {
  const raw = typeof value === 'string' ? value.trim() : '';

  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw;
  }

  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return fallback;
}
