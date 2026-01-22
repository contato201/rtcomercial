import { useGrowthData } from '@/hooks/useGrowthData';
import { useAuth } from '@/hooks/useAuth';
import { AppNavbar } from '@/components/AppNavbar';
import { GrowthMetricsCards } from '@/components/growth/GrowthMetricsCards';
import { GrowthFunnel } from '@/components/growth/GrowthFunnel';
import { GrowthDataForm } from '@/components/growth/GrowthDataForm';
import { GrowthFiltersComponent } from '@/components/growth/GrowthFilters';
import { CampaignsTable } from '@/components/growth/CampaignsTable';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { MONTHS } from '@/types/growth';

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
        <AppNavbar />
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
      <AppNavbar />

      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Título e Controles */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard de Growth</h1>
            <p className="text-sm text-muted-foreground">Funil de Tráfego & Métricas</p>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={selectedMonth.toString()}
              onValueChange={(value) => setSelectedMonth(parseInt(value))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, index) => (
                  <SelectItem key={month} value={index.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              onClick={syncFromSheets} 
              disabled={isSyncing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Sheets'}
            </Button>
          </div>
        </div>

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
        <div className="mb-6">
          <GrowthMetricsCards data={currentMonthData} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
      </div>
    </div>
  );
};

export default Growth;
