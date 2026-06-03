import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
      className={cn(
        'group relative inline-flex h-9 w-16 items-center rounded-full border border-border bg-muted/60 px-1 transition-all hover:border-primary/40',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full bg-card shadow-md transition-transform duration-300 ease-out',
          isDark ? 'translate-x-7' : 'translate-x-0',
        )}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
        ) : (
          <Sun className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
        )}
      </span>
      <Sun
        className={cn(
          'pointer-events-none absolute left-2 h-3 w-3 text-muted-foreground transition-opacity',
          isDark ? 'opacity-100' : 'opacity-0',
        )}
      />
      <Moon
        className={cn(
          'pointer-events-none absolute right-2 h-3 w-3 text-muted-foreground transition-opacity',
          isDark ? 'opacity-0' : 'opacity-100',
        )}
      />
    </button>
  );
};
