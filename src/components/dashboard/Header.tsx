import { BarChart3, TrendingUp } from 'lucide-react';

export const Header = () => {
  return (
    <header className="gradient-header text-primary-foreground py-6 px-8 rounded-2xl mb-8 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
            <BarChart3 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Dashboard Comercial</h1>
            <p className="text-white/80 text-sm">Acompanhamento de Metas vs Realizado</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm">
          <TrendingUp className="w-5 h-5" />
          <span className="font-medium">2025</span>
        </div>
      </div>
    </header>
  );
};
