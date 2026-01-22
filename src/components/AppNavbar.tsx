import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, LogIn, LogOut, Shield } from 'lucide-react';
import logo from '@/assets/logo.png';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
              <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium hidden sm:block">Editor</span>
              </div>
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
