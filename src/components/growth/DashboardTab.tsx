import { cn } from '@/lib/utils';
import { Lock, Clock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

export type TabState = 'active' | 'disabled' | 'no-data';

interface DashboardTabProps {
  label: string;
  state: TabState;
  expectedDate?: string;
  onClick?: () => void;
  isSelected?: boolean;
}

export const DashboardTab = ({
  label,
  state,
  expectedDate = 'Q1 2025',
  onClick,
  isSelected = false,
}: DashboardTabProps) => {
  const handleClick = () => {
    if (state === 'disabled') {
      return; // Não faz nada se desativado
    }
    
    if (state === 'no-data') {
      toast.info('Nenhum dado disponível para este período', {
        description: "Clique em 'Sincronizar Sheets' para carregar dados.",
        duration: 4000,
      });
      return;
    }
    
    onClick?.();
  };

  // Estado ATIVO
  if (state === 'active') {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "px-4 py-2 text-xs font-medium rounded-lg transition-all",
          isSelected
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        )}
      >
        {label}
      </button>
    );
  }

  // Estado DESATIVADO/EM BREVE
  if (state === 'disabled') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            disabled
            className={cn(
              "px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-not-allowed",
              "bg-muted/60 text-muted-foreground/60",
              "flex items-center gap-2"
            )}
          >
            <span>{label}</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              <Clock className="w-3 h-3" />
              Em Breve
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className="max-w-xs text-center bg-popover border border-border shadow-lg"
        >
          <div className="flex items-center gap-2 text-sm">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <span>Esta funcionalidade estará disponível em breve.</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Esperado para: <span className="font-medium text-foreground">{expectedDate}</span>
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Estado SEM DADOS
  if (state === 'no-data') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className={cn(
              "px-4 py-2 text-xs font-medium rounded-lg transition-all",
              "bg-muted/40 text-muted-foreground/70 hover:bg-muted/60 hover:text-muted-foreground",
              "border border-dashed border-muted-foreground/30"
            )}
          >
            {label}
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className="max-w-xs text-center bg-popover border border-border shadow-lg"
        >
          <p className="text-sm">Nenhum dado disponível para esta visualização.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Clique para ver detalhes ou sincronize os dados.
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
};
