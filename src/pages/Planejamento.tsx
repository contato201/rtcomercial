import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppNavbar } from '@/components/AppNavbar';
import { useAuth } from '@/hooks/useAuth';
import { MetasTable } from '@/components/planejamento/MetasTable';
import { ParametrosGlobais } from '@/components/planejamento/ParametrosGlobais';
import { EquipeSdrs } from '@/components/planejamento/EquipeSdrs';
import { usePlanejamento } from '@/lib/planejamento';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Users, Target, Percent } from 'lucide-react';

const Planejamento = () => {
  const { canEdit, isLoading } = useAuth();
  const navigate = useNavigate();
  const plan = usePlanejamento();

  useEffect(() => {
    if (!isLoading && !canEdit) navigate('/');
  }, [canEdit, isLoading, navigate]);

  if (isLoading || !canEdit) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="mx-auto max-w-6xl px-6 py-10 text-muted-foreground">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <header className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Planejamento</h1>
              <p className="text-sm text-muted-foreground">
                Configure metas mensais, ticket médio, taxa de comparecimento e equipe de SDRs sem precisar mexer no back end.
              </p>
            </div>
          </div>
        </header>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-4 w-4 text-primary" /> Metas Mensais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetasTable metas={plan.metas} ticket={plan.ticketMedio} />
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Percent className="h-4 w-4 text-primary" /> Parâmetros Globais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ParametrosGlobais ticket={plan.ticketMedio} taxa={plan.taxaComparecimento} />
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-4 w-4 text-primary" /> Equipe de SDRs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EquipeSdrs />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Planejamento;
