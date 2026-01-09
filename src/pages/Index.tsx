import { useDashboardData } from '@/hooks/useDashboardData';
import { Header } from '@/components/dashboard/Header';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { DataEntryForm } from '@/components/dashboard/DataEntryForm';
import { ChartsGrid } from '@/components/dashboard/ChartsGrid';

const Index = () => {
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
    resetData
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

        <StatsOverview
          data={aggregatedData}
          calculateVariation={calculateVariation}
        />

        <DataEntryForm
          selectedMonth={selectedMonth}
          currentData={data[selectedMonth]}
          onUpdate={updateMonthData}
          onReset={resetData}
        />

        <ChartsGrid
          filteredData={filteredData}
          aggregatedData={aggregatedData}
          filterType={filterType}
        />
      </div>
    </div>
  );
};

export default Index;
