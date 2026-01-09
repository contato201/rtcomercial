import { FilterType, QuarterType, MONTHS } from '@/types/dashboard';
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react';

interface FilterBarProps {
  filterType: FilterType;
  setFilterType: (type: FilterType) => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedQuarter: QuarterType;
  setSelectedQuarter: (quarter: QuarterType) => void;
}

export const FilterBar = ({
  filterType,
  setFilterType,
  selectedMonth,
  setSelectedMonth,
  selectedQuarter,
  setSelectedQuarter
}: FilterBarProps) => {
  const quarters: QuarterType[] = ['Q1', 'Q2', 'Q3', 'Q4'];
  const quarterLabels: Record<QuarterType, string> = {
    Q1: '1º Trimestre',
    Q2: '2º Trimestre',
    Q3: '3º Trimestre',
    Q4: '4º Trimestre'
  };

  return (
    <div className="dashboard-card p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Visualizar:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('month')}
              className={filterType === 'month' ? 'filter-btn-active' : 'filter-btn-inactive'}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Mês
            </button>
            <button
              onClick={() => setFilterType('quarter')}
              className={filterType === 'quarter' ? 'filter-btn-active' : 'filter-btn-inactive'}
            >
              <CalendarDays className="w-4 h-4 inline mr-2" />
              Trimestre
            </button>
            <button
              onClick={() => setFilterType('year')}
              className={filterType === 'year' ? 'filter-btn-active' : 'filter-btn-inactive'}
            >
              <CalendarRange className="w-4 h-4 inline mr-2" />
              Anual
            </button>
          </div>
        </div>

        {filterType === 'month' && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm font-medium text-muted-foreground">Mês:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="input-field max-w-[180px]"
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        )}

        {filterType === 'quarter' && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm font-medium text-muted-foreground">Trimestre:</span>
            <div className="flex gap-2">
              {quarters.map((q) => (
                <button
                  key={q}
                  onClick={() => setSelectedQuarter(q)}
                  className={selectedQuarter === q ? 'filter-btn-active' : 'filter-btn-inactive'}
                >
                  {quarterLabels[q]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
