import { useState } from 'react';
import { MonthData, MONTHS, VALOR_POR_VENDA } from '@/types/dashboard';
import { Save, RefreshCw, DollarSign, Users, Handshake, Calendar, Target } from 'lucide-react';

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

  const inputGroups = [
    {
      title: 'Vendas',
      icon: Target,
      fields: [
        { key: 'metaVendas', label: 'Meta', value: currentData.metaVendas },
        { key: 'realizadoVendas', label: 'Realizado', value: currentData.realizadoVendas }
      ]
    },
    {
      title: '1ª Reuniões',
      icon: Users,
      fields: [
        { key: 'metaPrimeiraReuniao', label: 'Meta', value: currentData.metaPrimeiraReuniao },
        { key: 'realizadoPrimeiraReuniao', label: 'Realizado', value: currentData.realizadoPrimeiraReuniao }
      ]
    },
    {
      title: '2ª Reuniões',
      icon: Calendar,
      fields: [
        { key: 'metaSegundaReuniao', label: 'Meta', value: currentData.metaSegundaReuniao },
        { key: 'realizadoSegundaReuniao', label: 'Realizado', value: currentData.realizadoSegundaReuniao }
      ]
    },
    {
      title: 'Fechamentos',
      icon: Handshake,
      fields: [
        { key: 'metaFechamentos', label: 'Meta', value: currentData.metaFechamentos },
        { key: 'realizadoFechamentos', label: 'Realizado', value: currentData.realizadoFechamentos }
      ]
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
            <p className="text-sm text-muted-foreground">{MONTHS[selectedMonth]} - Os dados são salvos automaticamente</p>
          </div>
        </div>
        
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Resetar Tudo
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
            <div className="space-y-3">
              {group.fields.map((field) => (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground block mb-1">{field.label}</label>
                  <input
                    type="number"
                    min="0"
                    value={field.value || ''}
                    onChange={(e) => handleInputChange(field.key as keyof MonthData, e.target.value)}
                    placeholder="0"
                    className="input-field text-center"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

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
            <p className="text-xs text-muted-foreground">Meta de Faturamento</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(currentData.metaFaturamento)}</p>
          </div>
          <div className="bg-card rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Faturamento Realizado</p>
            <p className="text-lg font-bold text-[hsl(var(--success))]">{formatCurrency(currentData.realizadoFaturamento)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
