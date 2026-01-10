import { TrendingUp } from 'lucide-react';
import logo from '@/assets/logo.png';

export const Header = () => {
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
        <div className="flex items-center gap-2 bg-gold/20 px-4 py-2 rounded-lg backdrop-blur-sm border border-gold/30">
          <TrendingUp className="w-5 h-5 text-gold" />
          <span className="font-medium text-gold">2026</span>
        </div>
      </div>
    </header>
  );
};