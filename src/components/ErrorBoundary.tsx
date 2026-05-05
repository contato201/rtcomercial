import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  handleClearAndReload = async () => {
    try {
      // Limpa storage para destravar sessões corrompidas do Supabase
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-') || k.includes('supabase')) localStorage.removeItem(k);
      });
    } catch {}
    window.location.href = '/auth';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="max-w-md w-full border border-border rounded-lg p-6 space-y-4 bg-card">
            <h1 className="text-xl font-bold text-foreground">Algo deu errado</h1>
            <p className="text-sm text-muted-foreground">
              Encontramos um erro inesperado ao carregar a página. Você pode recarregar ou
              limpar a sessão e fazer login novamente.
            </p>
            {this.state.error?.message && (
              <pre className="text-xs bg-muted/40 rounded p-2 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2">
              <Button onClick={this.handleReload} className="flex-1">Recarregar</Button>
              <Button onClick={this.handleClearAndReload} variant="outline" className="flex-1">
                Limpar sessão
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
