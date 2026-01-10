import { useState } from 'react';
import { MonthData, MONTHS, VALOR_POR_VENDA } from '@/types/dashboard';
import { Save, RefreshCw, DollarSign, Users, Handshake, Calendar, Target, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

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

  const getProgressStatus = (meta: number, realizado: number) => {
    if (meta === 0) return { percent: 0, status: 'neutral' };
    const percent = (realizado / meta) * 100;
    if (percent >= 100) return { percent, status: 'success' };
    if (percent >= 70) return { percent, status: 'warning' };
    return { percent, status: 'danger' };
  };

  // Grupos de entrada - apenas campos REALIZADOS são editáveis
  const inputGroups = [
    {
      title: 'Vendas',
      icon: Target,
      color: 'primary',
      meta: currentData.metaVendas,
      realizadoField: 'realizadoVendas' as keyof MonthData,
      realizadoValue: currentData.realizadoVendas
    },
    {
      title: '1ª Reuniões',
      icon: Users,
      color: 'blue',
      meta: currentData.metaPrimeiraReuniao,
      realizadoField: 'realizadoPrimeiraReuniao' as keyof MonthData,
      realizadoValue: currentData.realizadoPrimeiraReuniao
    },
    {
      title: '2ª Reuniões',
      icon: Calendar,
      color: 'purple',
      meta: currentData.metaSegundaReuniao,
      realizadoField: 'realizadoSegundaReuniao' as keyof MonthData,
      realizadoValue: currentData.realizadoSegundaReuniao
    },
    {
      title: 'Fechamentos',
      icon: Handshake,
      color: 'green',
      meta: currentData.metaFechamentos,
      realizadoField: 'realizadoFechamentos' as keyof MonthData,
      realizadoValue: currentData.realizadoFechamentos
    }
  ];

  return (
    <div className="dashboard-card p-6 border-2 border-primary/20 bg-gradient-to-br from-card to-accent/20">
      {/* Header destacado */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-3 rounded-xl shadow-lg">
            <Save className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">📝 Entrada de Dados</h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{MONTHS[selectedMonth]}</span> — Digite os valores realizados
            </p>
          </div>
        </div>
        
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-2 transition-colors px-3 py-2 rounded-lg hover:bg-destructive/10"
          >
            <RefreshCw className="w-4 h-4" />
            Resetar
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-destructive/10 px-4 py-2 rounded-lg">
            <span className="text-sm text-destructive font-medium">Confirmar reset?</span>
            <button
              onClick={() => {
                onReset();
                setShowResetConfirm(false);
              }}
              className="text-sm bg-destructive text-destructive-foreground px-3 py-1 rounded-md hover:opacity-90 font-medium"
            >
              Sim
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="text-sm bg-secondary text-secondary-foreground px-3 py-1 rounded-md hover:bg-muted font-medium"
            >
              Não
            </button>
          </div>
        )}
      </div>

      {/* Cards de entrada */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {inputGroups.map((group) => {
          const progress = getProgressStatus(group.meta, group.realizadoValue);
          const isComplete = progress.percent >= 100;
          
          return (
            <div key={group.title} className={`relative bg-card rounded-xl p-4 border-2 transition-all duration-300 ${
              isComplete 
                ? 'border-[hsl(var(--success))]/50 shadow-[0_0_20px_hsl(var(--success)/0.1)]' 
                : 'border-border hover:border-primary/30'
            }`}>
              {/* Indicador de conclusão */}
              {isComplete && (
                <div className="absolute -top-2 -right-2 bg-[hsl(var(--success))] rounded-full p-1 shadow-lg">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <group.icon className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">{group.title}</h3>
                </div>
              </div>
              
              {/* Meta fixa - visual destacado */}
              <div className="mb-3 p-2 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-primary/60" />
                  <span className="text-xs text-primary/80 font-medium">Meta</span>
                </div>
                <span className="text-lg font-bold text-primary">{group.meta}</span>
              </div>
              
              {/* Campo editável para realizado */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">
                  Realizado
                </label>
                <input
                  type="number"
                  min="0"
                  value={group.realizadoValue || ''}
                  onChange={(e) => handleInputChange(group.realizadoField, e.target.value)}
                  placeholder="Digite aqui..."
                  className={`input-field text-center text-xl font-bold transition-all ${
                    isComplete 
                      ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))]/5 text-[hsl(var(--success))]' 
                      : group.realizadoValue > 0 ? 'border-primary/50' : ''
                  }`}
                />
              </div>

              {/* Mini barra de progresso */}
              <div className="mt-3">
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      progress.status === 'success' ? 'bg-[hsl(var(--success))]' :
                      progress.status === 'warning' ? 'bg-warning' : 'bg-destructive'
                    }`}
                    style={{ width: `${Math.min(progress.percent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground mt-1">
                  {progress.percent.toFixed(0)}% da meta
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Faturamento calculado automaticamente */}
      <div className="mt-6 p-5 bg-gradient-to-r from-primary/5 to-accent rounded-xl border border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-primary/10 p-2 rounded-lg">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Faturamento</h3>
            <p className="text-xs text-muted-foreground">Calculado automaticamente (Vendas × R$ {VALOR_POR_VENDA.toLocaleString('pt-BR')})</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card rounded-xl p-4 border border-primary/20">
            <div className="flex items-center gap-1 mb-2">
              <Lock className="w-3 h-3 text-primary/60" />
              <p className="text-xs text-muted-foreground font-medium">Meta de Faturamento</p>
            </div>
            <p className="text-2xl font-bold text-primary">{formatCurrency(currentData.metaFaturamento)}</p>
          </div>
          <div className={`bg-card rounded-xl p-4 border ${
            currentData.realizadoFaturamento >= currentData.metaFaturamento 
              ? 'border-[hsl(var(--success))]/50' 
              : 'border-destructive/30'
          }`}>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Faturamento Realizado</p>
            <p className={`text-2xl font-bold ${
              currentData.realizadoFaturamento >= currentData.metaFaturamento 
                ? 'text-[hsl(var(--success))]' 
                : 'text-destructive'
            }`}>
              {formatCurrency(currentData.realizadoFaturamento)}
            </p>
            {currentData.realizadoFaturamento > 0 && (
              <p className={`text-xs mt-1 font-medium ${
                currentData.realizadoFaturamento >= currentData.metaFaturamento 
                  ? 'text-[hsl(var(--success))]' 
                  : 'text-destructive'
              }`}>
                {currentData.realizadoFaturamento >= currentData.metaFaturamento ? '✓ Meta atingida!' : 
                  `Faltam ${formatCurrency(currentData.metaFaturamento - currentData.realizadoFaturamento)}`
                }
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
