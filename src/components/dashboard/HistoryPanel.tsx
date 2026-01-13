import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, RotateCcw, TrendingUp, Users, DollarSign, Calendar, ShieldOff } from 'lucide-react';

interface HistoryRecord {
  id: string;
  dados_realizados_id: string;
  month: string;
  campo_alterado: string;
  valor_anterior: number;
  valor_novo: number;
  created_at: string;
}

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRevert: (month: string, field: string, value: number) => void;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const FIELD_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  realizado_vendas: { 
    label: 'Vendas', 
    icon: <TrendingUp className="h-4 w-4" />, 
    color: 'bg-green-500/10 text-green-600 border-green-500/20' 
  },
  realizado_faturamento: { 
    label: 'Faturamento', 
    icon: <DollarSign className="h-4 w-4" />, 
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' 
  },
  realizado_primeira_reuniao: { 
    label: '1ª Reuniões', 
    icon: <Users className="h-4 w-4" />, 
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' 
  },
  realizado_segunda_reuniao: { 
    label: '2ª Reuniões', 
    icon: <Calendar className="h-4 w-4" />, 
    color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' 
  },
  ticket_realizado: { 
    label: 'Valor por Venda', 
    icon: <DollarSign className="h-4 w-4" />, 
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
  },
};

export function HistoryPanel({ isOpen, onClose, onRevert }: HistoryPanelProps) {
  const { canEdit } = useAuth();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [confirmRevert, setConfirmRevert] = useState<HistoryRecord | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, selectedMonth]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('historico_alteracoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedMonth !== 'all') {
        query = query.eq('month', selectedMonth);
      }

      const { data, error } = await query;

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (record: HistoryRecord) => {
    try {
      // Map database field to the field used in updateMonthData
      const fieldMap: Record<string, string> = {
        realizado_vendas: 'realizadoVendas',
        realizado_faturamento: 'realizadoFaturamento',
        realizado_primeira_reuniao: 'realizadoPrimeiraReuniao',
        realizado_segunda_reuniao: 'realizadoSegundaReuniao',
        ticket_realizado: 'ticketRealizado',
      };

      const mappedField = fieldMap[record.campo_alterado];
      if (!mappedField) {
        toast.error('Campo não reconhecido');
        return;
      }

      onRevert(record.month, mappedField, record.valor_anterior);
      setConfirmRevert(null);
      toast.success('Valor revertido com sucesso!');
    } catch (error) {
      console.error('Error reverting:', error);
      toast.error('Erro ao reverter valor');
    }
  };

  const formatValue = (field: string, value: number) => {
    if (field === 'realizado_faturamento' || field === 'ticket_realizado') {
      return new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
      }).format(value);
    }
    return value.toString();
  };

  const getFieldConfig = (field: string) => {
    return FIELD_CONFIG[field] || { 
      label: field, 
      icon: <History className="h-4 w-4" />, 
      color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' 
    };
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Alterações
            </DialogTitle>
            <DialogDescription>
              Visualize todas as alterações feitas e reverta para valores anteriores se necessário.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4 py-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {MONTHS.map((month) => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {history.length} alterações encontradas
            </span>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <History className="h-12 w-12 mb-2 opacity-50" />
                <p>Nenhuma alteração registrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((record) => {
                  const fieldConfig = getFieldConfig(record.campo_alterado);
                  return (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <Badge 
                          variant="outline" 
                          className={`${fieldConfig.color} flex items-center gap-1`}
                        >
                          {fieldConfig.icon}
                          {fieldConfig.label}
                        </Badge>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{record.month}</span>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-red-500 line-through">
                              {formatValue(record.campo_alterado, record.valor_anterior)}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-green-600 font-medium">
                              {formatValue(record.campo_alterado, record.valor_novo)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(record.created_at), { 
                              addSuffix: true,
                              locale: ptBR 
                            })}
                          </span>
                        </div>
                      </div>
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmRevert(record)}
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reverter
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <ShieldOff className="h-3 w-3 mr-1" />
                          Somente leitura
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmRevert} onOpenChange={() => setConfirmRevert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Reversão</DialogTitle>
            <DialogDescription>
              {confirmRevert && (
                <>
                  Você está prestes a reverter o campo{' '}
                  <strong>{getFieldConfig(confirmRevert.campo_alterado).label}</strong> de{' '}
                  <strong>{confirmRevert.month}</strong> para o valor anterior:{' '}
                  <strong className="text-primary">
                    {formatValue(confirmRevert.campo_alterado, confirmRevert.valor_anterior)}
                  </strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevert(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => confirmRevert && handleRevert(confirmRevert)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Confirmar Reversão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
