import { useState } from 'react';
import { useGrowthData } from '@/hooks/useGrowthData';
import { useAuth } from '@/hooks/useAuth';
import { AppNavbar } from '@/components/AppNavbar';
import { GrowthFunnelMeta } from '@/components/growth/GrowthFunnelMeta';
import { GrowthDiario } from '@/components/growth/GrowthDiario';
import { GrowthDateRange, periodoPadrao, type Periodo } from '@/components/growth/GrowthDateRange';
import { GerenciadorMeta } from '@/components/growth/GerenciadorMeta';
import { useTrafegoDiario } from '@/hooks/useTrafegoDiario';
import { Skeleton } from '@/components/ui/skeleton';

const FILTRO_STORAGE_KEY = 'growth-filtro-campanha';

const Growth = () => {
  const { canEdit } = useAuth();
  const { isLoading } = useGrowthData();
  const [periodo, setPeriodo] = useState<Periodo>(periodoPadrao);
  // Filtro "contém" + nível (campanha/conjunto/anúncio) compartilhados entre o
  // funil e o dia a dia. Ficam salvos no navegador até o usuário mudar.
  const [filtro, setFiltroState] = useState<string>(() => {
    try { return localStorage.getItem(FILTRO_STORAGE_KEY) ?? ''; } catch { return ''; }
  });
  const setFiltro = (v: string) => {
    setFiltroState(v);
    try {
      if (v.trim()) localStorage.setItem(FILTRO_STORAGE_KEY, v);
      else localStorage.removeItem(FILTRO_STORAGE_KEY);
    } catch { /* armazenamento indisponível — filtro segue só em memória */ }
  };
  // O funil analisa por campanha; a visão por conjunto/anúncio fica no Gerenciador.
  const { rows: trafegoRows, loading: trafegoLoading } = useTrafegoDiario('campanha');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          <Skeleton className="h-12 md:h-16 w-full" />
          <Skeleton className="h-64 md:h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[480px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,hsl(var(--gold)/0.18),transparent_60%)]"
      />
      <AppNavbar />

      <div className="max-w-[1600px] mx-auto p-4 sm:p-5 md:p-6 lg:p-8">
        {/* Título e seletor de período */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard de Growth</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Tráfego Meta Ads — escolha o período</p>
          </div>

          <GrowthDateRange value={periodo} onChange={setPeriodo} />
        </div>

        {/* Funil de Growth - Meta Ads (filtro por campanha/conjunto/anúncio) */}
        <GrowthFunnelMeta
          periodo={periodo}
          filtro={filtro}
          onFiltroChange={setFiltro}
          rows={trafegoRows}
          rowsLoading={trafegoLoading}
        />

        {/* Growth Diário - Meta Ads (dia a dia + CPA + conversão) */}
        <GrowthDiario periodo={periodo} canEdit={canEdit} filtro={filtro} trafegoRows={trafegoRows} />

        {/* Gerenciador - todas as campanhas/conjuntos/anúncios com status */}
        <GerenciadorMeta periodo={periodo} />
      </div>
    </div>
  );
};

export default Growth;
