import { useState } from 'react';
import { MonthData, MONTHS, VALOR_POR_VENDA } from '@/types/dashboard';
import { Save, RefreshCw, DollarSign, Users, Calendar, Lock, CheckCircle2, History, ShieldOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface DataEntryFormProps {
  selectedMonth: number;
  currentData: MonthData;
  onUpdate: (monthIndex: number, updates: Partial<MonthData>) => void;
  onReset: () => void;
  onOpenHistory: () => void;
  canEdit: boolean;
}

export const DataEntryForm = ({ selectedMonth, currentData, onUpdate, onReset, onOpenHistory, canEdit }: DataEntryFormProps) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleInputChange = (field: keyof MonthData, value: string) => {
    if (!canEdit) return;
    const numValue = parseInt(value) || 0;
    onUpdate(selectedMonth, { [field]: numValue });
  };

  const handleCurrencyChange = (field: keyof MonthData, value: string) => {
    if (!canEdit) return;
    // Remove formatação e converte para número
    const cleanValue = value.replace(/\D/g, '');
    const numValue = parseInt(cleanValue) || 0;
    onUpdate(selectedMonth, { [field]: numValue });
  };


  const formatCurrencyInput = (value: number) => {
    if (value === 0) return '';
    return value.toLocaleString('pt-BR');
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

  // Grupos de entrada - apenas campos REALIZADOS são editáveis (Vendas movido para seção de Faturamento)
  const inputGroups = [
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
    }
  ];

  return (
    <div className="dashboard-card p-6 border-2 border-primary/20 bg-gradient-to-br from-card to-accent/20">
      {/* Banner de aviso quando não pode editar */}
      {!canEdit && (
        <div className="mb-4 p-3 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldOff className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-800 dark:text-amber-200 font-medium">
              Modo visualização — Faça login com o email autorizado para editar
            </span>
          </div>
          <Link to="/auth">
            <Button variant="outline" size="sm" className="border-amber-500 text-amber-700 hover:bg-amber-200 dark:hover:bg-amber-800">
              Fazer Login
            </Button>
          </Link>
        </div>
      )}
      
      {/* Header destacado */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-3 rounded-xl shadow-lg">
            <Save className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">📝 Entrada de Dados</h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{MONTHS[selectedMonth]}</span> — {canEdit ? 'Digite os valores realizados' : 'Visualização apenas'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenHistory}
            className="text-muted-foreground hover:text-primary"
          >
            <History className="w-4 h-4 mr-2" />
            Histórico
          </Button>
          
          {canEdit && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Cards de entrada */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {inputGroups.map((group) => {
          const realizadoValue = group.realizadoValue || 0;
          const metaValue = group.meta || 1;
          const progress = getProgressStatus(metaValue, realizadoValue);
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
                  disabled={!canEdit}
                  className={`input-field text-center text-xl font-bold transition-all ${
                    !canEdit ? 'cursor-not-allowed opacity-60' :
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
                  {metaValue > 0 ? `${((realizadoValue / metaValue) * 100).toFixed(0)}% da meta` : '0% da meta'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Faturamento - Quantidade + Valor por Venda */}
      <div className="mt-6 p-5 bg-gradient-to-r from-primary/5 to-accent rounded-xl border border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-primary/10 p-2 rounded-lg">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">💰 Faturamento</h3>
            <p className="text-xs text-muted-foreground">Digite quantidade de vendas e valor por venda</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Quantidade de Vendas */}
          <div className="bg-card rounded-xl p-4 border-2 border-border hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium">Quantidade de Vendas</p>
              <Badge variant="outline" className="text-primary border-primary/30 text-xs">
                Meta: {currentData.metaVendas}
              </Badge>
            </div>
            <input
              type="number"
              min="0"
              value={currentData.realizadoVendas || ''}
              onChange={(e) => handleInputChange('realizadoVendas', e.target.value)}
              placeholder="0"
              disabled={!canEdit}
              className={`input-field text-center text-2xl font-bold ${!canEdit ? 'cursor-not-allowed opacity-60' : ''}`}
            />
            {/* Mini barra de progresso de vendas */}
            <div className="mt-2">
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    currentData.realizadoVendas >= currentData.metaVendas && currentData.realizadoVendas > 0
                      ? 'bg-[hsl(var(--success))]' 
                      : currentData.realizadoVendas >= currentData.metaVendas * 0.7 
                        ? 'bg-warning' 
                        : 'bg-destructive'
                  }`}
                  style={{ width: `${Math.min((currentData.realizadoVendas / currentData.metaVendas) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground mt-1">
                {currentData.metaVendas > 0 
                  ? `${((currentData.realizadoVendas / currentData.metaVendas) * 100).toFixed(0)}% da meta`
                  : '0% da meta'
                }
              </p>
            </div>
          </div>

          {/* Valor por Venda (Ticket) */}
          <div className="bg-card rounded-xl p-4 border-2 border-border hover:border-primary/30 transition-all">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Valor por Venda (Ticket)</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">R$</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatCurrencyInput(currentData.ticketRealizado)}
                onChange={(e) => handleCurrencyChange('ticketRealizado', e.target.value)}
                placeholder="2.700"
                disabled={!canEdit}
                className={`input-field text-right text-xl font-bold pl-12 ${!canEdit ? 'cursor-not-allowed opacity-60' : ''}`}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Meta: {formatCurrency(VALOR_POR_VENDA)}
            </p>
          </div>

          {/* Meta de Faturamento */}
          <div className="bg-card rounded-xl p-4 border border-primary/20">
            <div className="flex items-center gap-1 mb-2">
              <Lock className="w-3 h-3 text-primary/60" />
              <p className="text-xs text-muted-foreground font-medium">Meta de Faturamento</p>
            </div>
            <p className="text-2xl font-bold text-primary">{formatCurrency(currentData.metaFaturamento)}</p>
          </div>

          {/* Faturamento Calculado */}
          <div className={`relative bg-card rounded-xl p-4 border-2 transition-all ${
            currentData.realizadoFaturamento >= currentData.metaFaturamento && currentData.realizadoFaturamento > 0
              ? 'border-[hsl(var(--success))]/50 shadow-[0_0_20px_hsl(var(--success)/0.1)]' 
              : 'border-border'
          }`}>
            {currentData.realizadoFaturamento >= currentData.metaFaturamento && currentData.realizadoFaturamento > 0 && (
              <div className="absolute -top-2 -right-2 bg-[hsl(var(--success))] rounded-full p-1 shadow-lg">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
            )}
            <p className="text-xs text-muted-foreground mb-2 font-medium">Faturamento Total</p>
            <p className={`text-2xl font-bold ${
              currentData.realizadoFaturamento >= currentData.metaFaturamento && currentData.realizadoFaturamento > 0
                ? 'text-[hsl(var(--success))]' 
                : 'text-foreground'
            }`}>
              {formatCurrency(currentData.realizadoFaturamento)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              = {currentData.realizadoVendas} × {formatCurrency(currentData.ticketRealizado)}
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

        {/* Barra de progresso do faturamento */}
        <div className="mt-4">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                currentData.realizadoFaturamento >= currentData.metaFaturamento 
                  ? 'bg-[hsl(var(--success))]' 
                  : currentData.realizadoFaturamento >= currentData.metaFaturamento * 0.7 
                    ? 'bg-warning' 
                    : 'bg-destructive'
              }`}
              style={{ width: `${Math.min((currentData.realizadoFaturamento / currentData.metaFaturamento) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground mt-1">
            {currentData.metaFaturamento > 0 
              ? `${((currentData.realizadoFaturamento / currentData.metaFaturamento) * 100).toFixed(0)}% da meta`
              : '0% da meta'
            }
          </p>
        </div>
      </div>
    </div>
  );
};
