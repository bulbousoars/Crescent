'use client';

import { Palette } from 'lucide-react';
import { useEffect, useState } from 'react';

const themes = [
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
  { key: 'dusk', label: 'Dusk' },
  { key: 'dawn', label: 'Dawn' },
] as const;

type Theme = (typeof themes)[number]['key'];

function isTheme(value: string | null): value is Theme {
  return themes.some((theme) => theme.key === value);
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('crescent-theme');
    const initialTheme = isTheme(savedTheme) ? savedTheme : 'light';
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  function selectTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('crescent-theme', nextTheme);
  }

  return (
    <label className="theme-switcher">
      <span>
        <Palette size={16} />
        Theme
      </span>
      <select className="theme-select" value={theme} onChange={(event) => selectTheme(event.target.value as Theme)}>
        {themes.map((item) => (
          <option key={item.key} value={item.key}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
