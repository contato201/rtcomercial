import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, LogIn, Mail, Lock, KeyRound } from 'lucide-react';

const AUTHORIZED_EMAILS = [
  'contato@allancatao.com.br',
  'parceiros@reproduzindotalentos.com.br',
  'comercial@reproduzindotalentos.com.br',
];
type LoginMethod = 'password' | 'magic' | 'recover';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const navigate = useNavigate();

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const isAuthorizedEmail = AUTHORIZED_EMAILS.includes(normalizedEmail);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && event !== 'PASSWORD_RECOVERY') {
        navigate('/');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!normalizedEmail) {
      toast.error('Informe seu email');
      return;
    }

    if (!isAuthorizedEmail) {
      toast.error('Acesso restrito: use um email autorizado');
      return;
    }

    if (loginMethod === 'password' && !password) {
      toast.error('Informe sua senha');
      return;
    }

    setIsLoading(true);

    try {
      if (loginMethod === 'recover') {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success('Enviamos um link de recuperação para seu email.');
        return;
      }

      if (loginMethod === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          toast.error('Link mágico indisponível no momento. Use senha.');
          setLoginMethod('password');
          return;
        }

        toast.success('Enviamos um link de acesso para seu email.');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Email ou senha incorretos');
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success('Login realizado com sucesso!');
      navigate('/');
    } catch (error) {
      toast.error('Erro ao processar sua solicitação');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="dashboard-card p-8 border-2 border-primary/20">
          <div className="text-center mb-8">
            <div className="bg-primary/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <LogIn className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Acessar Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Acesso restrito aos emails autorizados
            </p>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={loginMethod === 'password' ? 'default' : 'outline'}
              onClick={() => setLoginMethod('password')}
              disabled={isLoading}
              size="sm"
            >
              <Lock className="w-4 h-4 mr-1" />
              Senha
            </Button>
            <Button
              type="button"
              variant={loginMethod === 'magic' ? 'default' : 'outline'}
              onClick={() => setLoginMethod('magic')}
              disabled={isLoading}
              size="sm"
            >
              <Mail className="w-4 h-4 mr-1" />
              Link
            </Button>
            <Button
              type="button"
              variant={loginMethod === 'recover' ? 'default' : 'outline'}
              onClick={() => setLoginMethod('recover')}
              disabled={isLoading}
              size="sm"
            >
              <KeyRound className="w-4 h-4 mr-1" />
              Recuperar
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                disabled={isLoading}
              />
            </div>

            {loginMethod === 'password' && (
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setLoginMethod('recover')}
                  className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            {loginMethod === 'recover' && (
              <p className="text-xs text-muted-foreground">
                Enviaremos um link para você redefinir sua senha no email informado.
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Aguarde...
                </>
              ) : loginMethod === 'magic' ? (
                'Enviar link'
              ) : loginMethod === 'recover' ? (
                'Enviar link de recuperação'
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
