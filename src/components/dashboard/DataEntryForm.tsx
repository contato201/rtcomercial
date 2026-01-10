import { useState } from 'react';
import { MonthData, MONTHS, VALOR_POR_VENDA } from '@/types/dashboard';
import { Save, RefreshCw, DollarSign, Users, Handshake, Calendar, Target, Lock } from 'lucide-react';

interface DataEntryFormProps {
  selectedMonth: number;
  currentData: MonthData;
  onUpdate: (monthIndex: number, updates: Partial<MonthData>) => void;
  onReset: () => void;
}

export const DataEntryForm = ({ selectedMonth, currentData, onUpdate, onReset }: DataEntryFormProps) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleInputChange = (field: keyof MonthData, value: string) => {
    const numValue = parseInt(value) || 0;
    onUpdate(selectedMonth, { [field]: numValue });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Grupos de entrada - apenas campos REALIZADOS são editáveis
  const inputGroups = [
    {
      title: 'Vendas',
      icon: Target,
      meta: currentData.metaVendas,
      realizadoField: 'realizadoVendas' as keyof MonthData,
      realizadoValue: currentData.realizadoVendas
    },
    {
      title: '1ª Reuniões',
      icon: Users,
      meta: currentData.metaPrimeiraReuniao,
      realizadoField: 'realizadoPrimeiraReuniao' as keyof MonthData,
      realizadoValue: currentData.realizadoPrimeiraReuniao
    },
    {
      title: '2ª Reuniões',
      icon: Calendar,
      meta: currentData.metaSegundaReuniao,
      realizadoField: 'realizadoSegundaReuniao' as keyof MonthData,
      realizadoValue: currentData.realizadoSegundaReuniao
    },
    {
      title: 'Fechamentos',
      icon: Handshake,
      meta: currentData.metaFechamentos,
      realizadoField: 'realizadoFechamentos' as keyof MonthData,
      realizadoValue: currentData.realizadoFechamentos
    }
  ];

  return (
    <div className="dashboard-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Save className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Entrada de Dados</h2>
            <p className="text-sm text-muted-foreground">{MONTHS[selectedMonth]} - Digite apenas os valores realizados</p>
          </div>
        </div>
        
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Resetar Realizados
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-destructive">Confirmar reset?</span>
            <button
              onClick={() => {
                onReset();
                setShowResetConfirm(false);
              }}
              className="text-sm bg-destructive text-destructive-foreground px-3 py-1 rounded-md hover:opacity-90"
            >
              Sim
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="text-sm bg-secondary text-secondary-foreground px-3 py-1 rounded-md hover:bg-muted"
            >
              Não
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {inputGroups.map((group) => (
          <div key={group.title} className="bg-secondary/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <group.icon className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-foreground">{group.title}</h3>
            </div>
            
            {/* Meta fixa - somente leitura */}
            <div className="mb-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-1 mb-1">
                <Lock className="w-3 h-3 text-primary/60" />
                <span className="text-xs text-primary/80 font-medium">Meta (fixa)</span>
              </div>
              <span className="text-xl font-bold text-primary">{group.meta}</span>
            </div>
            
            {/* Campo editável para realizado */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Realizado</label>
              <input
                type="number"
                min="0"
                value={group.realizadoValue || ''}
                onChange={(e) => handleInputChange(group.realizadoField, e.target.value)}
                placeholder="0"
                className="input-field text-center text-lg font-semibold"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Faturamento calculado automaticamente */}
      <div className="mt-6 p-4 bg-accent rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-5 h-5 text-primary" />
          <h3 className="font-medium text-foreground">Faturamento (calculado automaticamente)</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Valor por venda: {formatCurrency(VALOR_POR_VENDA)}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              <Lock className="w-3 h-3 text-primary/60" />
              <p className="text-xs text-muted-foreground">Meta de Faturamento (fixa)</p>
            </div>
            <p className="text-lg font-bold text-primary">{formatCurrency(currentData.metaFaturamento)}</p>
          </div>
          <div className="bg-card rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Faturamento Realizado</p>
            <p className={`text-lg font-bold ${currentData.realizadoFaturamento >= currentData.metaFaturamento ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
              {formatCurrency(currentData.realizadoFaturamento)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
