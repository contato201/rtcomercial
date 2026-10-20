import { AppNavbar } from '@/components/AppNavbar';

/**
 * Aba Prospecção: a ferramenta de listas é um programa à parte, publicado no mesmo
 * endereço em /prospeccao-app, e aparece aqui dentro do dashboard. Ela usa o login
 * e o tema (claro/escuro) daqui; quem pode entrar é definido lá, na tela Equipe.
 */
const Prospeccao = () => (
  <div className="flex h-screen flex-col bg-background">
    <AppNavbar />
    <iframe src="/prospeccao-app/" title="Prospecção" className="min-h-0 w-full flex-1 border-0" />
  </div>
);

export default Prospeccao;
