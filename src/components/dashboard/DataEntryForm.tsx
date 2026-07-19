import { useState } from 'react';
import { MonthData, MONTHS, VALOR_POR_VENDA, getValorPorVenda } from '@/types/dashboard';
import { Save, RefreshCw, DollarSign, Users, Calendar, Lock, CheckCircle2, History, ShieldOff, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { UnitSalesEditor, type UnitSale } from '@/components/dashboard/UnitSalesEditor';
import { AgendamentosEditor, type AgendamentoRow } from '@/components/dashboard/AgendamentosEditor';
import { ReunioesEditor, type ReuniaoEntry } from '@/components/dashboard/ReunioesEditor';
import { TaxasPorSdr } from '@/components/dashboard/TaxasPorSdr';
import { MetasSemanais } from '@/components/dashboard/MetasSemanais';
import { clampPercentage, safePercentage } from '@/lib/formatters';
import { businessDaysInMonth, businessDaysRemainingInMonth, DASHBOARD_YEAR } from '@/lib/businessDays';

interface DataEntryFormProps {
  selectedMonth: number;
  currentData: MonthData;
  unitSales: UnitSale[];
  agendamentos: AgendamentoRow[];
  reunioesEntries: ReuniaoEntry[];
  metaAgendamentos: number;
  filterType?: 'month' | 'quarter' | 'year';
  onUpdate: (monthIndex: number, updates: Partial<MonthData>) => void;
  onAddUnitSale: (monthIndex: number, valor: number, cliente: string, pessoa: string, origem: string) => Promise<void> | void;
  onUpdateUnitSale: (id: string, valor: number, cliente: string, pessoa: string, origem: string) => Promise<void> | void;
  onDeleteUnitSale: (id: string) => Promise<void> | void;
  onAddAgendamento: (monthIndex: number, pessoa: string, quantidade: number, dataLancamento?: string) => Promise<void>;
  onDeleteAgendamento: (id: string) => Promise<void>;
  onAddReuniaoEntry: (monthIndex: number, tipo: 'primeira' | 'segunda', quantidade: number, dataLancamento?: string, pessoa?: string, leadNome?: string, origem?: string) => Promise<void>;
  onDeleteReuniaoEntry: (id: string) => Promise<void>;
  onReset: () => void;
  onOpenHistory: () => void;
  canEdit: boolean;
}

export const DataEntryForm = ({
  selectedMonth,
  currentData,
  unitSales,
  agendamentos,
  reunioesEntries,
  metaAgendamentos,
  filterType = 'month',
  onUpdate,
  onAddUnitSale,
  onUpdateUnitSale,
  onDeleteUnitSale,
  onAddAgendamento,
  onDeleteAgendamento,
  onAddReuniaoEntry,
  onDeleteReuniaoEntry,
  onReset,
  onOpenHistory,
  canEdit,
}: DataEntryFormProps) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const monthName = MONTHS[selectedMonth];
  const diasUteisMes = businessDaysInMonth(DASHBOARD_YEAR, selectedMonth);
  const diasUteisRestantes = businessDaysRemainingInMonth(DASHBOARD_YEAR, selectedMonth);
  const realizadoAgendamentosMes = agendamentos
    .filter((a) => a.month === monthName)
    .reduce((sum, a) => sum + Number(a.quantidade || 0), 0);

  const handleInputChange = (field: keyof MonthData, value: string) => {
    if (!canEdit) return;
    const numValue = parseInt(value) || 0;
    onUpdate(selectedMonth, { [field]: numValue });
  };

  // vendas/ticket agora são calculados pelas vendas unitárias


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
    const percent = safePercentage(realizado, meta);
    if (percent === 0) return { percent, status: 'neutral' };
    if (percent >= 100) return { percent, status: 'success' };
    if (percent >= 70) return { percent, status: 'warning' };
    return { percent, status: 'danger' };
  };

  const pacingRows = [
    { label: 'Agendamentos', meta: metaAgendamentos, realizado: realizadoAgendamentosMes },
    { label: '1ª Reuniões', meta: currentData.metaPrimeiraReuniao, realizado: currentData.realizadoPrimeiraReuniao },
    { label: '2ª Reuniões', meta: currentData.metaSegundaReuniao, realizado: currentData.realizadoSegundaReuniao },
    { label: 'Vendas', meta: currentData.metaVendas, realizado: currentData.realizadoVendas },
    { label: 'Faturamento', meta: currentData.metaFaturamento, realizado: currentData.realizadoFaturamento, currency: true },
  ];

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

      {/* Banner informativo quando visualização não é mensal */}
      {filterType !== 'month' && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              🔍 Editando: <span className="font-bold">{MONTHS[selectedMonth]}</span> | Visualização: {filterType === 'year' ? 'Anual' : 'Trimestral'}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">
              Na visualização {filterType === 'year' ? 'anual' : 'trimestral'}, o formulário edita apenas o mês selecionado. Para editar outro mês, selecione-o no filtro acima.
            </p>
          </div>
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

      <div className="mb-6 rounded-xl border border-border/60 bg-card/70 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Ritmo comercial</p>
            <h3 className="text-base font-bold text-foreground">{monthName}: {diasUteisRestantes} dias úteis restantes</h3>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary">
            {diasUteisMes} dias úteis no mês
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          {pacingRows.map((row) => {
            const falta = Math.max(0, row.meta - row.realizado);
            const ritmo = diasUteisRestantes > 0 ? Math.ceil(falta / diasUteisRestantes) : falta;
            return (
              <div key={row.label} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{row.label}</div>
                <div className="mt-2 text-sm font-bold text-foreground">
                  {row.currency ? formatCurrency(row.realizado) : row.realizado} / {row.currency ? formatCurrency(row.meta) : row.meta}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Faltam {row.currency ? formatCurrency(falta) : falta} · ritmo {row.currency ? `${formatCurrency(ritmo)}/dia` : `${ritmo}/dia`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 1. AGENDAMENTOS - Primeiro do funil */}
      <div className="mb-6">
        <AgendamentosEditor
          selectedMonth={selectedMonth}
          agendamentos={agendamentos}
          metaAgendamentos={metaAgendamentos}
          onAddAgendamento={onAddAgendamento}
          onDeleteAgendamento={onDeleteAgendamento}
          canEdit={canEdit}
        />
      </div>

      {/* 2. REUNIÕES - 1ª e 2ª (lançamento incremental) */}
      <div className="grid grid-cols-1 gap-4 mb-6">
        <ReunioesEditor
          selectedMonth={selectedMonth}
          tipo="primeira"
          label="1ª Reuniões"
          entries={reunioesEntries}
          meta={currentData.metaPrimeiraReuniao}
          realizadoFallback={currentData.realizadoPrimeiraReuniao}
          onAdd={onAddReuniaoEntry}
          onDelete={onDeleteReuniaoEntry}
          canEdit={canEdit}
        />
        <ReunioesEditor
          selectedMonth={selectedMonth}
          tipo="segunda"
          label="2ª Reuniões"
          entries={reunioesEntries}
          meta={currentData.metaSegundaReuniao}
          realizadoFallback={currentData.realizadoSegundaReuniao}
          onAdd={onAddReuniaoEntry}
          onDelete={onDeleteReuniaoEntry}
          canEdit={canEdit}
        />
      </div>

      {/* 3. METAS SEMANAIS - Pacing semanal vs meta proporcional */}
      <div className="mb-6">
        <MetasSemanais
          selectedMonth={selectedMonth}
          metaAgendamentos={metaAgendamentos}
          metaPrimeiraReuniao={currentData.metaPrimeiraReuniao}
          metaSegundaReuniao={currentData.metaSegundaReuniao}
          metaVendas={currentData.metaVendas}
          metaFaturamento={currentData.metaFaturamento}
          agendamentos={agendamentos}
          reunioesEntries={reunioesEntries}
          unitSales={unitSales}
        />
      </div>

      {/* 4. TAXAS DE CONVERSÃO POR SDR */}
      <div className="mb-6">
        <TaxasPorSdr
          selectedMonth={selectedMonth}
          agendamentos={agendamentos}
          reunioesEntries={reunioesEntries}
          unitSales={unitSales}
        />
      </div>

      {/* 4. FATURAMENTO - Final do funil */}
      <div className="p-5 bg-gradient-to-r from-primary/5 to-accent rounded-xl border border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-primary/10 p-2 rounded-lg">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">💰 Faturamento</h3>
            <p className="text-xs text-muted-foreground">Calculado automaticamente pelas vendas unitárias</p>
          </div>
        </div>

        <div className="mb-4">
          <UnitSalesEditor
            monthLabel={MONTHS[selectedMonth]}
            sales={unitSales}
            canEdit={canEdit}
            onAdd={(valor, cliente, pessoa, origem) => onAddUnitSale(selectedMonth, valor, cliente, pessoa, origem)}
            onUpdate={onUpdateUnitSale}
            onDelete={onDeleteUnitSale}
          />
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
              placeholder="0"
              disabled
              className="input-field text-center text-2xl font-bold cursor-not-allowed opacity-60"
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
                  style={{ width: `${clampPercentage(safePercentage(currentData.realizadoVendas, currentData.metaVendas))}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground mt-1">
                {`${safePercentage(currentData.realizadoVendas, currentData.metaVendas).toFixed(0)}% da meta`}
              </p>
            </div>
          </div>

          {/* Valor por Venda (Ticket) */}
          <div className="bg-card rounded-xl p-4 border-2 border-border hover:border-primary/30 transition-all">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Ticket médio (calculado)</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">R$</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatCurrencyInput(currentData.ticketRealizado)}
                placeholder="2.700"
                disabled
                className="input-field text-right text-xl font-bold pl-12 cursor-not-allowed opacity-60"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Referência: {formatCurrency(getValorPorVenda())}
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
              Soma das vendas unitárias ({currentData.realizadoVendas} vendas)
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
              style={{ width: `${clampPercentage(safePercentage(currentData.realizadoFaturamento, currentData.metaFaturamento))}%` }}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground mt-1">
            {`${safePercentage(currentData.realizadoFaturamento, currentData.metaFaturamento).toFixed(0)}% da meta`}
          </p>
        </div>
      </div>
    </div>
  );
};
