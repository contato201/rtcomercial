import { useEffect } from 'react';

/**
 * Deixa a página clara enquanto ela estiver aberta, seja qual for o tema do
 * dashboard — e devolve o tema de antes ao sair.
 *
 * As telas que o lead vê (procurar a reunião e a porta da sala) são sempre
 * claras: passam confiança e não dependem do gosto de quem configurou o
 * dashboard. A sala de vídeo em si é sempre escura, por outro motivo — fundo
 * claro atrás do vídeo cansa a vista.
 *
 * Não mexe no localStorage de propósito: a preferência do Allan continua
 * intacta quando ele volta para o dashboard.
 */
export function useTemaClaro() {
  useEffect(() => {
    const raiz = document.documentElement;
    const antes = raiz.classList.contains('dark') ? 'dark' : 'light';

    // A marca avisa o ThemeProvider para não desfazer o que fazemos aqui.
    raiz.dataset.temaForcado = 'claro';
    raiz.classList.remove('dark');
    raiz.classList.add('light');
    raiz.style.colorScheme = 'light';

    return () => {
      delete raiz.dataset.temaForcado;
      raiz.classList.remove('light', 'dark');
      raiz.classList.add(antes);
      raiz.style.colorScheme = antes;
    };
  }, []);
}
