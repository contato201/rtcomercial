import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, UserSearch, LogIn, LogOut, Pencil } from 'lucide-react';
import logo from '@/assets/logo.png';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: 'Comercial', href: '/', icon: LayoutDashboard },
  { label: 'Growth', href: '/growth', icon: TrendingUp },
  { label: 'Análise de Perfil', href: '/analise', icon: UserSearch },
];

export const AppNavbar = () => {
  const location = useLocation();
  const { user, signOut, canEdit, isAuthenticated } = useAuth();

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
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
            </nav>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-3">
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
