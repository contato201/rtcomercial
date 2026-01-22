import { useState, useEffect } from 'react';
import { GrowthData } from '@/types/growth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Calendar, ShoppingCart, DollarSign, Save, Loader2, Check, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface GrowthDataFormProps {
  data: GrowthData;
  onUpdate: (updates: Partial<Pick<GrowthData, 'leadsQualificados' | 'reunioesAgendadas' | 'vendasFechadas' | 'valorVendas'>>) => Promise<void>;
  canEdit: boolean;
}

// Validation rules for each field
const VALIDATION_RULES = {
  leadsQualificados: { min: 0, max: 10000, label: 'leads' },
  reunioesAgendadas: { min: 0, max: 10000, label: 'reuniões' },
  vendasFechadas: { min: 0, max: 10000, label: 'vendas' },
  valorVendas: { min: 0, max: 1000000, label: 'valor' },
} as const;

type FieldKey = keyof typeof VALIDATION_RULES;
type SaveState = 'idle' | 'saving' | 'success' | 'error';

export const GrowthDataForm = ({ data, onUpdate, canEdit }: GrowthDataFormProps) => {
  const [formData, setFormData] = useState({
    leadsQualificados: data.leadsQualificados,
    reunioesAgendadas: data.reunioesAgendadas,
    vendasFechadas: data.vendasFechadas,
    valorVendas: data.valorVendas,
  });

  const [errors, setErrors] = useState<Record<FieldKey, string | null>>({
    leadsQualificados: null,
    reunioesAgendadas: null,
    vendasFechadas: null,
    valorVendas: null,
  });

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Update form data when props change (month selection)
  useEffect(() => {
    setFormData({
      leadsQualificados: data.leadsQualificados,
      reunioesAgendadas: data.reunioesAgendadas,
      vendasFechadas: data.vendasFechadas,
      valorVendas: data.valorVendas,
    });
    // Clear errors when data changes
    setErrors({
      leadsQualificados: null,
      reunioesAgendadas: null,
      vendasFechadas: null,
      valorVendas: null,
    });
  }, [data]);

  const validateField = (field: FieldKey, value: number): string | null => {
    const rules = VALIDATION_RULES[field];
    
    if (value < rules.min) {
      return `Mínimo ${rules.min} ${rules.label}`;
    }
    
    if (value > rules.max) {
      const formattedMax = field === 'valorVendas' 
        ? `R$ ${rules.max.toLocaleString('pt-BR')}`
        : rules.max.toLocaleString('pt-BR');
      return `⚠️ Máximo ${formattedMax} ${rules.label}`;
    }
    
    return null;
  };

  const handleChange = (field: FieldKey, value: string) => {
    const numValue = field === 'valorVendas' 
      ? parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0
      : parseInt(value) || 0;
    
    // Validate in real-time
    const error = validateField(field, numValue);
    setErrors(prev => ({ ...prev, [field]: error }));
    
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  const hasErrors = Object.values(errors).some(error => error !== null);

  const handleSave = async () => {
    if (!canEdit) {
      toast.error('Você não tem permissão para editar');
      return;
    }

    if (hasErrors) {
      toast.error('Corrija os erros antes de salvar');
      return;
    }

    setSaveState('saving');

    try {
      await onUpdate(formData);
      setSaveState('success');
      setLastSaved(new Date());
      
      toast.success('Dados salvos com sucesso', {
        description: `Última atualização: ${formatTimestamp(new Date())}`,
      });

      // Reset to idle after 2 seconds
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (error) {
      setSaveState('error');
      toast.error('Erro ao salvar dados', {
        description: 'Tente novamente ou contate suporte',
      });
      
      // Reset to idle after 3 seconds
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }) + ' às ' + date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fields = [
    {
      key: 'leadsQualificados' as const,
      label: 'Leads Qualificados (MQL)',
      sublabel: `De ${data.leadsTotal} leads totais`,
      icon: Users,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      key: 'reunioesAgendadas' as const,
      label: 'Reuniões Agendadas',
      sublabel: 'Vindas dos MQLs',
      icon: Calendar,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      key: 'vendasFechadas' as const,
      label: 'Vendas Fechadas',
      sublabel: 'Conversões finais',
      icon: ShoppingCart,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      key: 'valorVendas' as const,
      label: 'Valor das Vendas',
      sublabel: formatCurrency(formData.valorVendas),
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      isCurrency: true,
    },
  ];

  // Button configuration based on save state
  const getButtonConfig = () => {
    switch (saveState) {
      case 'saving':
        return {
          icon: Loader2,
          text: 'Salvando...',
          className: '',
          disabled: true,
          iconClassName: 'animate-spin',
        };
      case 'success':
        return {
          icon: Check,
          text: '✅ Salvo',
          className: 'bg-green-600 hover:bg-green-700 text-white',
          disabled: true,
          iconClassName: '',
        };
      case 'error':
        return {
          icon: X,
          text: '❌ Erro - Tentar novamente',
          className: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
          disabled: false,
          iconClassName: '',
        };
      default:
        return {
          icon: Save,
          text: 'Salvar Dados Manuais',
          className: '',
          disabled: hasErrors,
          iconClassName: '',
        };
    }
  };

  const buttonConfig = getButtonConfig();
  const ButtonIcon = buttonConfig.icon;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Dados Manuais - {data.month}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {fields.map((field) => {
              const error = errors[field.key];
              const hasError = error !== null;
              
              return (
                <div key={field.key} className="space-y-1.5 sm:space-y-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <div className={`p-1 sm:p-1.5 rounded-md ${field.bgColor} flex-shrink-0`}>
                      <field.icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${field.color}`} />
                    </div>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Label 
                          className="text-[10px] sm:text-xs font-medium truncate cursor-help leading-relaxed block max-w-full"
                          style={{ lineHeight: '1.5' }}
                        >
                          {field.label}
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="top" 
                        className="bg-popover text-popover-foreground border-border max-w-[200px]"
                      >
                        <p className="text-xs font-medium">{field.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="relative">
                    <Input
                      type={field.isCurrency ? 'text' : 'number'}
                      value={field.isCurrency ? formData[field.key] : formData[field.key]}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      disabled={!canEdit}
                      className={`h-9 sm:h-10 min-h-[44px] sm:min-h-0 text-sm ${hasError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      placeholder={field.isCurrency ? 'R$ 0,00' : '0'}
                      min={0}
                      max={field.isCurrency ? 1000000 : 10000}
                    />
                    {hasError && (
                      <div className="absolute -bottom-4 sm:-bottom-5 left-0 flex items-center gap-1 text-[9px] sm:text-[10px] text-destructive">
                        <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span className="truncate max-w-[120px]">{error}</span>
                      </div>
                    )}
                  </div>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <p 
                        className={`text-[9px] sm:text-[10px] text-muted-foreground truncate cursor-help ${hasError ? 'mt-3 sm:mt-4' : ''}`}
                        style={{ lineHeight: '1.5' }}
                      >
                        {field.sublabel}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="bottom" 
                      className="bg-popover text-popover-foreground border-border"
                    >
                      <p className="text-xs">{field.sublabel}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>

          {canEdit && (
            <div className="space-y-2 pt-1 sm:pt-2">
              <Button 
                onClick={handleSave} 
                className={`w-full min-h-[44px] sm:min-h-0 ${buttonConfig.className}`} 
                size="sm"
                disabled={buttonConfig.disabled}
              >
                <ButtonIcon className={`w-4 h-4 mr-2 ${buttonConfig.iconClassName}`} />
                <span className="text-sm">{buttonConfig.text}</span>
              </Button>
              
              {lastSaved && (
                <p className="text-[9px] sm:text-[10px] text-center text-muted-foreground">
                  Última atualização: {formatTimestamp(lastSaved)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
