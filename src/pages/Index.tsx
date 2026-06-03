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
import { Download, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FunnelOverview } from '@/components/dashboard/FunnelOverview';


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

  // Realizado de agendamentos do período filtrado
  const monthsInFilter = new Set(filteredData.map((d) => d.month));
  const realizadoAgendamentos = agendamentos
    .filter((a) => monthsInFilter.has(a.month))
    .reduce((sum, a) => sum + (a.quantidade ?? 0), 0);

  const periodLabel =
    filterType === 'month' ? data[selectedMonth].month : filterType === 'quarter' ? selectedQuarter : 'Visão Anual';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNavbar />

      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        {/* Header premium */}
        <div className="mb-8 flex flex-col gap-4 border-b border-[hsl(var(--gold)/0.2)] pb-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--gold))] text-background shadow-[0_8px_24px_-8px_hsl(var(--gold)/0.6)]">
              <BarChart3 className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Dashboard <span className="text-[hsl(var(--gold))]">Comercial</span>
              </h1>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {periodLabel} · Metas vs Realizado
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 bg-white/5 text-foreground hover:border-[hsl(var(--gold)/0.4)] hover:bg-white/10"
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
            <Download className="mr-2 h-4 w-4" />
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

        {/* Funil — visão executiva no topo */}
        <div className="mb-8">
          <FunnelOverview data={aggregatedData} realizadoAgendamentos={realizadoAgendamentos} />
        </div>

        {/* Formulário de entrada */}
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

        {/* Cards de variação */}
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
          selectedMonth={selectedMonth}
          agendamentos={agendamentos}
          reunioesEntries={reunioesEntries}
          unitSales={unitSalesByMonth[data[selectedMonth].month] ?? []}
          isLoading={isLoading}
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
