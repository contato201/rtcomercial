import { useGrowthData } from '@/hooks/useGrowthData';
import { useAuth } from '@/hooks/useAuth';
import { AppNavbar } from '@/components/AppNavbar';
import { GrowthMetricsCards } from '@/components/growth/GrowthMetricsCards';
import { GrowthFunnel } from '@/components/growth/GrowthFunnel';
import { GrowthDataForm } from '@/components/growth/GrowthDataForm';
import { GrowthFiltersComponent } from '@/components/growth/GrowthFilters';
import { CampaignsTable } from '@/components/growth/CampaignsTable';
import { SyncStatusBanner } from '@/components/growth/SyncStatusBanner';
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
    lastSyncTime,
    hasData,
    investimentoAcumulado,
    syncFromSheets,
    updateManualData,
  } = useGrowthData();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          <Skeleton className="h-12 md:h-16 w-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-20 md:h-24" />
            ))}
          </div>
          <Skeleton className="h-64 md:h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />

      <div className="max-w-[1600px] mx-auto p-4 sm:p-5 md:p-6 lg:p-8">
        {/* Título e Controles - Responsivo */}
        <div className="flex flex-col gap-4 mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard de Growth</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Funil de Tráfego & Métricas</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger className="w-full sm:w-[160px] min-h-[44px] sm:min-h-0">
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
                onClick={() => syncFromSheets()} 
                disabled={isSyncing}
                variant="outline"
                size="sm"
                className="min-h-[44px] sm:min-h-0"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="sm:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar Sheets'}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Banner de Status de Sincronização */}
        <SyncStatusBanner
          lastSyncTime={lastSyncTime}
          onSync={() => syncFromSheets()}
          isSyncing={isSyncing}
          hasData={hasData}
        />

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
        <div className="mb-4 md:mb-6">
          <GrowthMetricsCards 
            data={currentMonthData} 
            lastSyncTime={lastSyncTime}
            isLoading={isLoading}
            isSyncing={isSyncing}
            hasData={hasData}
            investimentoAcumulado={investimentoAcumulado}
          />
        </div>

        {/* Layout Responsivo: Funil + Form */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
          {/* Funil Visual */}
          <GrowthFunnel 
            data={currentMonthData} 
            lastSyncTime={lastSyncTime}
            isLoading={isLoading}
            isSyncing={isSyncing}
            hasData={hasData}
          />

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
