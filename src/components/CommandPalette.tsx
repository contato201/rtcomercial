import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  TrendingUp,
  UserSearch,
  Calendar,
  Download,
  History,
  Sun,
  Moon,
  LogIn,
  LogOut,
} from 'lucide-react';
import { MONTHS } from '@/types/dashboard';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMonth?: (monthIndex: number) => void;
  onExportCsv?: () => void;
  onOpenHistory?: () => void;
}

export const CommandPalette = ({
  open,
  onOpenChange,
  onSelectMonth,
  onExportCsv,
  onOpenHistory,
}: CommandPaletteProps) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, signOut } = useAuth();

  const run = (fn: () => void) => {
    onOpenChange(false);
    setTimeout(fn, 0);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar comandos, navegar, alternar tema..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => run(() => navigate('/'))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Comercial
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/growth'))}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Growth
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate('/analise'))}>
            <UserSearch className="mr-2 h-4 w-4" />
            Análise de Perfil
          </CommandItem>
        </CommandGroup>

        {onSelectMonth && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Saltar para mês">
              {MONTHS.map((m, i) => (
                <CommandItem key={m} onSelect={() => run(() => onSelectMonth(i))}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {m}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Ações">
          {onExportCsv && (
            <CommandItem onSelect={() => run(onExportCsv)}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </CommandItem>
          )}
          {onOpenHistory && (
            <CommandItem onSelect={() => run(onOpenHistory)}>
              <History className="mr-2 h-4 w-4" />
              Abrir histórico
            </CommandItem>
          )}
          <CommandItem onSelect={() => run(toggleTheme)}>
            {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Alternar tema ({theme === 'dark' ? 'claro' : 'escuro'})
          </CommandItem>
          {isAuthenticated ? (
            <CommandItem onSelect={() => run(() => signOut())}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </CommandItem>
          ) : (
            <CommandItem onSelect={() => run(() => navigate('/auth'))}>
              <LogIn className="mr-2 h-4 w-4" />
              Entrar
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export const useCommandPalette = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return { open, setOpen };
};
