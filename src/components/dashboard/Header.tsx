import { TrendingUp, LogIn, LogOut, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

export const Header = () => {
  const { user, signOut, canEdit, isAuthenticated } = useAuth();

  return (
    <header className="gradient-header text-white py-6 px-8 rounded-2xl mb-8 shadow-lg border border-gold/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-black/30 p-2 rounded-xl backdrop-blur-sm border border-gold/20">
            <img src={logo} alt="Reproduzindo Talentos" className="h-12 w-auto" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gold">Dashboard Comercial</h1>
            <p className="text-gold-light/80 text-sm">Acompanhamento de Metas vs Realizado</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Link para Dashboard de Growth */}
          <Link to="/growth">
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent border-gold/30 text-gold hover:bg-gold/20 hover:text-gold"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Growth
            </Button>
          </Link>
          
          {canEdit && (
            <div className="flex items-center gap-1 bg-green-600/20 px-3 py-1.5 rounded-lg border border-green-500/30">
              <Shield className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-300 font-medium">Editor</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 bg-gold/20 px-4 py-2 rounded-lg backdrop-blur-sm border border-gold/30">
            <TrendingUp className="w-5 h-5 text-gold" />
            <span className="font-medium text-gold">2026</span>
          </div>
          
          {isAuthenticated ? (
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="bg-transparent border-gold/30 text-gold hover:bg-gold/20 hover:text-gold"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          ) : (
            <Link to="/auth">
              <Button
                variant="outline"
                size="sm"
                className="bg-transparent border-gold/30 text-gold hover:bg-gold/20 hover:text-gold"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Entrar
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};