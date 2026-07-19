import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, LogIn, LogOut, Pencil, Settings } from 'lucide-react';
import logo from '@/assets/logo.png';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: 'Comercial', href: '/', icon: LayoutDashboard },
  { label: 'Growth', href: '/growth', icon: TrendingUp },
];

export const AppNavbar = () => {
  const location = useLocation();
  const { user, signOut, canEdit, isAdmin, isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo e Navegação */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3">
              <img src={logo} alt="Reproduzindo Talentos" className="h-10 w-auto" />
              <span className="font-bold text-foreground hidden sm:block">RT Dashboard</span>
            </Link>

            {/* Tabs de Navegação */}
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  to="/planejamento"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    location.pathname === '/planejamento'
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Settings className="w-4 h-4" />
                  Planejamento
                </Link>
              )}
            </nav>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
              }}
              className="hidden md:inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              title="Abrir paleta de comandos"
            >
              <span>Buscar</span>
              <kbd className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px] text-foreground/80 border border-border">⌘K</kbd>
            </button>
            <ThemeToggle />

            {canEdit && (
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 cursor-default">
                      <Pencil className="w-4 h-4 text-primary" />
                      <span className="text-xs text-primary font-medium hidden sm:block">Editar Layout</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-popover text-popover-foreground border-border">
                    <p className="text-xs">Editar layout do dashboard</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {isAuthenticated ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            ) : (
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <LogIn className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Entrar</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
