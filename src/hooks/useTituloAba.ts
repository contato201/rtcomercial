import { useEffect } from 'react';

/**
 * Troca o nome da aba do navegador enquanto a página estiver aberta e devolve
 * o de antes ao sair. O lead não deve ver "Dashboard Comercial" na aba da
 * reunião dele.
 */
export function useTituloAba(titulo: string) {
  useEffect(() => {
    const antes = document.title;
    document.title = titulo;
    return () => {
      document.title = antes;
    };
  }, [titulo]);
}
