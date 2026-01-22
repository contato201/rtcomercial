/**
 * Componente reutilizável para exibir valores de métricas
 * com 3 estados visuais distintos: no-data, zero, loading, value
 */
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Loader2 } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';

export type MetricState = 'no-data' | 'zero' | 'loading' | 'value';

interface MetricValueProps {
  value: number;
  formatter: (value: number) => string;
  isLoading?: boolean;
  isSyncing?: boolean;
  hasData?: boolean;
  lastSyncTime?: Date | null;
  className?: string;
  showSyncTooltip?: boolean;
}

export const getMetricState = (
  value: number,
  isLoading: boolean,
  isSyncing: boolean,
  hasData: boolean
): MetricState => {
  if (isLoading || isSyncing) return 'loading';
  if (!hasData) return 'no-data';
  if (value === 0) return 'zero';
  return 'value';
};

export const MetricValue = ({
  value,
  formatter,
  isLoading = false,
  isSyncing = false,
  hasData = true,
  lastSyncTime,
  className = '',
  showSyncTooltip = false,
}: MetricValueProps) => {
  const state = getMetricState(value, isLoading, isSyncing, hasData);

  // Estado: Loading
  if (state === 'loading') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="w-4 h-4 text-primary animate-spin" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  // Estado: No Data
  if (state === 'no-data') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-2 cursor-help ${className}`}>
            <div className="flex items-center justify-center w-6 h-6 rounded bg-muted">
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="text-lg font-bold text-muted-foreground">—</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[200px]">
          <p>Nenhum dado disponível.</p>
          <p className="text-muted-foreground">Clique em 'Sincronizar Sheets' para carregar.</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Estado: Zero ou Value
  const formattedValue = formatter(value);

  // Se tem tooltip de sincronização
  if (showSyncTooltip && lastSyncTime) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`text-lg font-bold cursor-help ${className}`}>
            {formattedValue}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>Sincronizado em {formatDateTime(lastSyncTime)}</p>
          <p className="text-muted-foreground">(fonte: Google Sheets)</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className={`text-lg font-bold ${className}`}>
      {formattedValue}
    </span>
  );
};
