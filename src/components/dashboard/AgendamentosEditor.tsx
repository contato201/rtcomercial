import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, Calendar, User } from 'lucide-react';
import { MONTHS } from '@/types/dashboard';
import { clampPercentage, safePercentage } from '@/lib/formatters';

export interface AgendamentoRow {
  id: string;
  month: string;
  pessoa: 'Tadeu' | 'Nicole';
  quantidade: number;
  data_lancamento: string;
  created_at: string;
}

interface AgendamentosEditorProps {
  selectedMonth: number;
  agendamentos: AgendamentoRow[];
  metaAgendamentos: number; // Calculado: metaPrimeiraReuniao / 0.6
  onAddAgendamento: (monthIndex: number, pessoa: 'Tadeu' | 'Nicole', quantidade: number) => Promise<void>;
  onDeleteAgendamento: (id: string) => Promise<void>;
  canEdit: boolean;
}

export const AgendamentosEditor = ({
  selectedMonth,
  agendamentos,
  metaAgendamentos,
  onAddAgendamento,
  onDeleteAgendamento,
  canEdit,
}: AgendamentosEditorProps) => {
  const [quantidadeTadeu, setQuantidadeTadeu] = useState('');
  const [quantidadeNicole, setQuantidadeNicole] = useState('');
  const [isAddingTadeu, setIsAddingTadeu] = useState(false);
  const [isAddingNicole, setIsAddingNicole] = useState(false);
  const [errorTadeu, setErrorTadeu] = useState('');
  const [errorNicole, setErrorNicole] = useState('');

  const monthName = MONTHS[selectedMonth];
  const monthAgendamentos = agendamentos.filter(a => a.month === monthName);
  
  const agendamentosTadeu = monthAgendamentos.filter(a => a.pessoa === 'Tadeu');
  const agendamentosNicole = monthAgendamentos.filter(a => a.pessoa === 'Nicole');
  
  const totalTadeu = agendamentosTadeu.reduce((sum, a) => sum + Number(a.quantidade || 0), 0);
  const totalNicole = agendamentosNicole.reduce((sum, a) => sum + Number(a.quantidade || 0), 0);
  const totalGeral = totalTadeu + totalNicole;

  const metaPorPessoa = Math.ceil(metaAgendamentos / 2);
  const progressoTadeu = safePercentage(totalTadeu, metaPorPessoa);
  const progressoNicole = safePercentage(totalNicole, metaPorPessoa);
  const progressoGeral = safePercentage(totalGeral, metaAgendamentos);

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleAddTadeu = async () => {
    const qtd = parseInt(quantidadeTadeu, 10);
    if (isNaN(qtd) || qtd <= 0) {
      setErrorTadeu('Digite um número válido maior que zero');
      return;
    }
    setErrorTadeu('');
    setIsAddingTadeu(true);
    try {
      await onAddAgendamento(selectedMonth, 'Tadeu', qtd);
      setQuantidadeTadeu('');
    } catch (e) {
      console.error(e);
      setErrorTadeu('Erro ao adicionar');
    } finally {
      setIsAddingTadeu(false);
    }
  };

  const handleAddNicole = async () => {
    const qtd = parseInt(quantidadeNicole, 10);
    if (isNaN(qtd) || qtd <= 0) {
      setErrorNicole('Digite um número válido maior que zero');
      return;
    }
    setErrorNicole('');
    setIsAddingNicole(true);
    try {
      await onAddAgendamento(selectedMonth, 'Nicole', qtd);
      setQuantidadeNicole('');
    } catch (e) {
      console.error(e);
      setErrorNicole('Erro ao adicionar');
    } finally {
      setIsAddingNicole(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          📅 Agendamentos - {monthName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumo Geral */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Meta Total</span>
            <span className="font-bold text-lg">{Math.ceil(metaAgendamentos)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Realizado Total</span>
            <span className="font-bold text-lg text-primary">{totalGeral}</span>
          </div>
          <Progress value={Math.min(progressoGeral, 100)} className="h-2" />
          <div className="text-xs text-muted-foreground text-right">
            {progressoGeral.toFixed(1)}% da meta
          </div>
        </div>

        {/* Grid com Tadeu e Nicole */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tadeu */}
          <div className="border border-border/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-semibold">Tadeu</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span>Meta: {metaPorPessoa}</span>
              <span className="font-medium">Realizado: {totalTadeu}</span>
            </div>
            
            <Progress 
              value={Math.min(progressoTadeu, 100)} 
              className={`h-2 ${getProgressColor(progressoTadeu)}`}
            />
            
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Qtd"
                  value={quantidadeTadeu}
                  onChange={(e) => setQuantidadeTadeu(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTadeu()}
                  className="flex-1"
                  min={1}
                />
                <Button 
                  size="sm" 
                  onClick={handleAddTadeu}
                  disabled={isAddingTadeu}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            {errorTadeu && <p className="text-xs text-destructive">{errorTadeu}</p>}
            
            {/* Lista de lançamentos do Tadeu */}
            {agendamentosTadeu.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {agendamentosTadeu.map((a) => (
                  <div 
                    key={a.id} 
                    className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1"
                  >
                    <span>{formatDate(a.data_lancamento)}</span>
                    <span className="font-medium">+{a.quantidade}</span>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                        onClick={() => onDeleteAgendamento(a.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nicole */}
          <div className="border border-border/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-secondary-foreground" />
              <span className="font-semibold">Nicole</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span>Meta: {metaPorPessoa}</span>
              <span className="font-medium">Realizado: {totalNicole}</span>
            </div>
            
            <Progress 
              value={Math.min(progressoNicole, 100)} 
              className={`h-2 ${getProgressColor(progressoNicole)}`}
            />
            
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Qtd"
                  value={quantidadeNicole}
                  onChange={(e) => setQuantidadeNicole(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNicole()}
                  className="flex-1"
                  min={1}
                />
                <Button 
                  size="sm" 
                  onClick={handleAddNicole}
                  disabled={isAddingNicole}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            {errorNicole && <p className="text-xs text-destructive">{errorNicole}</p>}
            
            {/* Lista de lançamentos da Nicole */}
            {agendamentosNicole.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {agendamentosNicole.map((a) => (
                  <div 
                    key={a.id} 
                    className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1"
                  >
                    <span>{formatDate(a.data_lancamento)}</span>
                    <span className="font-medium">+{a.quantidade}</span>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                        onClick={() => onDeleteAgendamento(a.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fórmula explicativa */}
        <div className="text-xs text-muted-foreground bg-muted/20 rounded p-2">
          <strong>Cálculo:</strong> Meta Agendamentos = Meta 1ª Reuniões ({Math.ceil(metaAgendamentos * 0.6)}) ÷ 60% comparecimento = {Math.ceil(metaAgendamentos)}
        </div>
      </CardContent>
    </Card>
  );
};
