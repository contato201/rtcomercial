import { useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useAuth } from '@/hooks/useAuth';
import { AppNavbar } from '@/components/AppNavbar';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { DataEntryForm } from '@/components/dashboard/DataEntryForm';
import { ChartsGrid } from '@/components/dashboard/ChartsGrid';
import { HistoryPanel } from '@/components/dashboard/HistoryPanel';
import { exportDashboardCsv } from '@/lib/exportCsv';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const { canEdit } = useAuth();
  
  const {
    data,
    filteredData,
    aggregatedData,
    unitSalesByMonth,
    agendamentos,
    reunioesEntries,
    filterType,
    setFilterType,
    selectedMonth,
    setSelectedMonth,
    selectedQuarter,
    setSelectedQuarter,
    updateMonthData,
    addUnitSale,
    updateUnitSale,
    deleteUnitSale,
    addAgendamento,
    deleteAgendamento,
    addReuniaoEntry,
    deleteReuniaoEntry,
    getMetaAgendamentos,
    calculateVariation,
    resetData,
    revertToValue,
    isLoading,
  } = useDashboardData();

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Título da página */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard Comercial</h1>
            <p className="text-sm text-muted-foreground">Acompanhamento de Metas vs Realizado</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const label = filterType === 'month'
                ? data[selectedMonth].month
                : filterType === 'quarter'
                  ? selectedQuarter
                  : 'Anual';
              exportDashboardCsv(
                filterType === 'month' ? [data[selectedMonth]] : filteredData,
                `dashboard-${label}-2025`
              );
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
        
        <FilterBar
          filterType={filterType}
          setFilterType={setFilterType}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedQuarter={selectedQuarter}
          setSelectedQuarter={setSelectedQuarter}
        />

        {/* Formulário de entrada PRIMEIRO - mais visível */}
        <div className="mb-8">
          <DataEntryForm
            selectedMonth={selectedMonth}
            currentData={data[selectedMonth]}
            filterType={filterType}
            unitSales={unitSalesByMonth[data[selectedMonth].month] ?? []}
            agendamentos={agendamentos}
            reunioesEntries={reunioesEntries}
            metaAgendamentos={getMetaAgendamentos(selectedMonth)}
            onUpdate={updateMonthData}
            onAddUnitSale={addUnitSale}
            onUpdateUnitSale={updateUnitSale}
            onDeleteUnitSale={deleteUnitSale}
            onAddAgendamento={addAgendamento}
            onDeleteAgendamento={deleteAgendamento}
            onAddReuniaoEntry={addReuniaoEntry}
            onDeleteReuniaoEntry={deleteReuniaoEntry}
            onReset={resetData}
            onOpenHistory={() => setIsHistoryOpen(true)}
            canEdit={canEdit}
          />
        </div>

        {/* Cards de estatísticas */}
        <StatsOverview
          data={aggregatedData}
          calculateVariation={calculateVariation}
        />

        {/* Gráficos comparativos */}
        <ChartsGrid
          filteredData={filteredData}
          aggregatedData={aggregatedData}
          filterType={filterType}
          selectedQuarter={selectedQuarter}
          agendamentos={agendamentos}
        />
      </div>

      {/* Painel de Histórico */}
      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRevert={revertToValue}
      />
    </div>
  );
};

export default Index;
