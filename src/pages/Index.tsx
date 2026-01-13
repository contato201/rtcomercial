import { useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Header } from '@/components/dashboard/Header';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { DataEntryForm } from '@/components/dashboard/DataEntryForm';
import { ChartsGrid } from '@/components/dashboard/ChartsGrid';
import { HistoryPanel } from '@/components/dashboard/HistoryPanel';

const Index = () => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const {
    data,
    filteredData,
    aggregatedData,
    filterType,
    setFilterType,
    selectedMonth,
    setSelectedMonth,
    selectedQuarter,
    setSelectedQuarter,
    updateMonthData,
    calculateVariation,
    resetData,
    revertToValue
  } = useDashboardData();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <Header />
        
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
            onUpdate={updateMonthData}
            onReset={resetData}
            onOpenHistory={() => setIsHistoryOpen(true)}
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
