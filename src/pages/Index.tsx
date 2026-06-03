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
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Decorative gold glow background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[480px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,hsl(var(--gold)/0.18),transparent_60%)]"
      />

      <AppNavbar />

      <div className="relative z-10 mx-auto max-w-[1600px] p-6 lg:p-8">
        {/* Header premium */}
        <div className="mb-8 flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))] text-primary-foreground shadow-[0_10px_30px_-10px_hsl(var(--gold)/0.7)] ring-1 ring-[hsl(var(--gold)/0.3)]">
              <BarChart3 className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Dashboard <span className="bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))] bg-clip-text text-transparent">Comercial</span>
              </h1>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {periodLabel} · Metas vs Realizado
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-border/60 bg-card/50 backdrop-blur-sm hover:border-primary/40 hover:bg-accent"
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
