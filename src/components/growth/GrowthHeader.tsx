import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { MONTHS } from '@/types/growth';
import { Link } from 'react-router-dom';
import logo from '@/assets/logo.png';

interface GrowthHeaderProps {
  selectedMonth: number;
  onMonthChange: (month: number) => void;
  onSync: () => void;
  isSyncing: boolean;
}

export const GrowthHeader = ({ selectedMonth, onMonthChange, onSync, isSyncing }: GrowthHeaderProps) => {
  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Voltar</span>
          </Link>
          <div className="h-6 w-px bg-border" />
          <img src={logo} alt="Logo" className="h-8 w-auto" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Dashboard de Growth</h1>
            <p className="text-sm text-muted-foreground">Funil de Tráfego & Métricas</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={selectedMonth.toString()}
            onValueChange={(value) => onMonthChange(parseInt(value))}
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
            onClick={onSync} 
            disabled={isSyncing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Sheets'}
          </Button>
        </div>
      </div>
    </header>
  );
};
