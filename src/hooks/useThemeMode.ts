import { useCallback, useEffect, useState } from 'react';

const KEY = 'vaimoto.theme';

export function useThemeMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem(KEY);
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.body.classList.toggle('dark', dark);
    localStorage.setItem(KEY, dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = useCallback(() => setDark((prev) => !prev), []);

  return { dark, toggle };
}
