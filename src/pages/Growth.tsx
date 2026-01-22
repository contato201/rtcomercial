import { useGrowthData } from '@/hooks/useGrowthData';
import { useAuth } from '@/hooks/useAuth';
import { GrowthHeader } from '@/components/growth/GrowthHeader';
import { GrowthMetricsCards } from '@/components/growth/GrowthMetricsCards';
import { GrowthFunnel } from '@/components/growth/GrowthFunnel';
import { GrowthDataForm } from '@/components/growth/GrowthDataForm';
import { Skeleton } from '@/components/ui/skeleton';

const Growth = () => {
  const { canEdit } = useAuth();
  const {
    currentMonthData,
    selectedMonth,
    setSelectedMonth,
    isLoading,
    isSyncing,
    syncFromSheets,
    updateManualData,
  } = useGrowthData();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6 space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <GrowthHeader
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        onSync={syncFromSheets}
        isSyncing={isSyncing}
      />

      <main className="p-6 space-y-6">
        {/* Métricas Principais */}
        <GrowthMetricsCards data={currentMonthData} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Funil Visual */}
          <GrowthFunnel data={currentMonthData} />

          {/* Formulário de Dados Manuais */}
          <GrowthDataForm
            data={currentMonthData}
            onUpdate={(updates) => updateManualData(selectedMonth, updates)}
            canEdit={canEdit}
          />
        </div>

        {/* Dados do Sheets */}
        <div className="bg-card rounded-xl p-6 border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-4">Dados do Tráfego (Google Sheets)</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{currentMonthData.impressoes.toLocaleString('pt-BR')}</p>
              <p className="text-sm text-muted-foreground">Impressões</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{currentMonthData.cliques.toLocaleString('pt-BR')}</p>
              <p className="text-sm text-muted-foreground">Cliques</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{currentMonthData.leadsTotal.toLocaleString('pt-BR')}</p>
              <p className="text-sm text-muted-foreground">Leads Totais</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-foreground">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentMonthData.cpc)}
              </p>
              <p className="text-sm text-muted-foreground">CPC Médio</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-foreground">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentMonthData.investimento)}
              </p>
              <p className="text-sm text-muted-foreground">Investimento</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Growth;
