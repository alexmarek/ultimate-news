'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {}
  }

  if (!mounted) {
    return <div className="w-11 h-11 shrink-0" />;
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center w-11 h-11 shrink-0   text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun aria-hidden="true" className="w-5 h-5 md:w-4 md:h-4" /> : <Moon aria-hidden="true" className="w-5 h-5 md:w-4 md:h-4" />}
    </button>
  );
}
