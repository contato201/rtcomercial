import { useGrowthData } from '@/hooks/useGrowthData';
import { useAuth } from '@/hooks/useAuth';
import { GrowthHeader } from '@/components/growth/GrowthHeader';
import { GrowthMetricsCards } from '@/components/growth/GrowthMetricsCards';
import { GrowthFunnel } from '@/components/growth/GrowthFunnel';
import { GrowthDataForm } from '@/components/growth/GrowthDataForm';
import { GrowthFiltersComponent } from '@/components/growth/GrowthFilters';
import { CampaignsTable } from '@/components/growth/CampaignsTable';
import { Skeleton } from '@/components/ui/skeleton';

const Growth = () => {
  const { canEdit } = useAuth();
  const {
    currentMonthData,
    campaigns,
    filteredCampaigns,
    availableFilters,
    activeFilters,
    setActiveFilters,
    clearFilters,
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
        {/* Filtros */}
        {campaigns.length > 0 && (
          <GrowthFiltersComponent
            availableFilters={availableFilters}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            onClearFilters={clearFilters}
            campaignCount={campaigns.length}
            filteredCount={filteredCampaigns.length}
          />
        )}

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

        {/* Tabela de Campanhas */}
        <CampaignsTable campaigns={filteredCampaigns} />
      </main>
    </div>
  );
};

export default Growth;
