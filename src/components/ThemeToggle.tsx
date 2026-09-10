import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'motion/react';

interface ThemeToggleProps {
  variant?: 'pill' | 'icon' | 'compact';
  className?: string;
}

export default function ThemeToggle({ variant = 'pill', className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme, setTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`relative p-2 rounded-xl transition-all text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-amber-300 dark:hover:bg-slate-800/80 active:scale-95 ${className}`}
        title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
        aria-label="Alternar tema de cores"
      >
        <motion.div
          key={theme}
          initial={{ rotate: -90, scale: 0.7, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.7, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {theme === 'dark' ? (
            <Sun size={20} className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
          ) : (
            <Moon size={20} className="text-slate-600" />
          )}
        </motion.div>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:border-slate-700/80 dark:text-slate-200 dark:hover:bg-slate-800 transition-all text-xs font-semibold shadow-sm active:scale-95 ${className}`}
      >
        {theme === 'dark' ? (
          <>
            <Sun size={15} className="text-amber-400" />
            <span>Modo Claro</span>
          </>
        ) : (
          <>
            <Moon size={15} className="text-slate-600" />
            <span>Modo Escuro</span>
          </>
        )}
      </button>
    );
  }

  // Pill variant (default) with both Claro and Escuro tabs
  return (
    <div className={`flex items-center p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/60 transition-colors ${className}`}>
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
          theme === 'light'
            ? 'bg-white text-slate-800 shadow-sm shadow-slate-200/60'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
      >
        <Sun size={14} className={theme === 'light' ? 'text-amber-500' : 'opacity-70'} />
        <span>Claro</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
          theme === 'dark'
            ? 'bg-slate-900 text-amber-300 shadow-sm shadow-slate-950/60 border border-slate-700/50'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
      >
        <Moon size={14} className={theme === 'dark' ? 'text-amber-300' : 'opacity-70'} />
        <span>Escuro</span>
      </button>
    </div>
  );
}
