import { useState } from 'react';
import { GrowthData } from '@/types/growth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Users, Calendar, ShoppingCart, DollarSign, Save } from 'lucide-react';
import { toast } from 'sonner';

interface GrowthDataFormProps {
  data: GrowthData;
  onUpdate: (updates: Partial<Pick<GrowthData, 'leadsQualificados' | 'reunioesAgendadas' | 'vendasFechadas' | 'valorVendas'>>) => void;
  canEdit: boolean;
}

export const GrowthDataForm = ({ data, onUpdate, canEdit }: GrowthDataFormProps) => {
  const [formData, setFormData] = useState({
    leadsQualificados: data.leadsQualificados,
    reunioesAgendadas: data.reunioesAgendadas,
    vendasFechadas: data.vendasFechadas,
    valorVendas: data.valorVendas,
  });

  const handleChange = (field: keyof typeof formData, value: string) => {
    const numValue = field === 'valorVendas' 
      ? parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0
      : parseInt(value) || 0;
    
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  const handleSave = () => {
    if (!canEdit) {
      toast.error('Você não tem permissão para editar');
      return;
    }
    onUpdate(formData);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Dados Manuais - {data.month}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${field.bgColor}`}>
                  <field.icon className={`w-3.5 h-3.5 ${field.color}`} />
                </div>
                <Label className="text-xs font-medium">{field.label}</Label>
              </div>
              <Input
                type={field.isCurrency ? 'text' : 'number'}
                value={field.isCurrency ? formData[field.key] : formData[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                disabled={!canEdit}
                className="h-9"
                placeholder={field.isCurrency ? 'R$ 0,00' : '0'}
              />
              <p className="text-[10px] text-muted-foreground">{field.sublabel}</p>
            </div>
          ))}
        </div>

        {canEdit && (
          <Button onClick={handleSave} className="w-full" size="sm">
            <Save className="w-4 h-4 mr-2" />
            Salvar Dados Manuais
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
