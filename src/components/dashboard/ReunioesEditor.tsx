import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, Users } from 'lucide-react';
import { MONTHS } from '@/types/dashboard';

export interface ReuniaoEntry {
  id: string;
  month: string;
  tipo: 'primeira' | 'segunda';
  quantidade: number;
  data_lancamento: string;
  created_at: string;
}

interface ReunioesEditorProps {
  selectedMonth: number;
  tipo: 'primeira' | 'segunda';
  label: string;
  icon?: React.ReactNode;
  entries: ReuniaoEntry[];
  meta: number;
  onAdd: (monthIndex: number, tipo: 'primeira' | 'segunda', quantidade: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canEdit: boolean;
}

export const ReunioesEditor = ({
  selectedMonth,
  tipo,
  label,
  entries,
  meta,
  onAdd,
  onDelete,
  canEdit,
}: ReunioesEditorProps) => {
  const [quantidade, setQuantidade] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  const monthName = MONTHS[selectedMonth];
  const monthEntries = entries.filter(e => e.month === monthName && e.tipo === tipo);
  const total = monthEntries.reduce((sum, e) => sum + e.quantidade, 0);
  const progresso = meta > 0 ? (total / meta) * 100 : 0;

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleAdd = async () => {
    const qtd = parseInt(quantidade, 10);
    if (isNaN(qtd) || qtd <= 0) {
      setError('Digite um número válido maior que zero');
      return;
    }
    setError('');
    setIsAdding(true);
    try {
      await onAdd(selectedMonth, tipo, qtd);
      setQuantidade('');
    } catch (e) {
      console.error(e);
      setError('Erro ao adicionar');
    } finally {
      setIsAdding(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="border border-border/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <span className="font-semibold">{label}</span>
      </div>

      <div className="flex justify-between text-sm">
        <span>Meta: {meta}</span>
        <span className="font-medium">Realizado: {total}</span>
      </div>

      <Progress
        value={Math.min(progresso, 100)}
        className={`h-2 ${getProgressColor(progresso)}`}
      />
      <div className="text-xs text-muted-foreground text-right">
        {progresso.toFixed(1)}% da meta
      </div>

      {canEdit && (
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Qtd"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1"
            min={1}
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={isAdding}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {monthEntries.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-1">
          {monthEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1"
            >
              <span>{formatDate(entry.data_lancamento)}</span>
              <span className="font-medium">+{entry.quantidade}</span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                  onClick={() => onDelete(entry.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
