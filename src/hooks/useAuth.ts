import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { clearInvalidAuthStorage } from '@/lib/sessionGuard';

// E-mails autorizados para edição (lançar dados, editar dashboard)
const AUTHORIZED_EMAILS = [
  'contato@allancatao.com.br',
  'parceiros@reproduzindotalentos.com.br',
  'comercial@reproduzindotalentos.com.br',
];

// E-mails com acesso de administrador (painel de Planejamento de metas/SDRs)
const ADMIN_EMAILS = [
  'contato@allancatao.com.br',
];

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);
    });

    supabase.auth.getSession()
      .then(({ data: { session: existing }, error }) => {
        if (!mounted) return;
        if (error) {
          // Refresh token inválido / expirado — limpa para evitar loops
          console.warn('[useAuth] getSession error, signing out:', error.message);
          clearInvalidAuthStorage();
          supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          setSession(null);
          setUser(null);
        } else {
          setSession(existing);
          setUser(existing?.user ?? null);
        }
      })
      .catch((err) => {
        console.warn('[useAuth] getSession threw:', err);
        clearInvalidAuthStorage();
        if (!mounted) return;
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[useAuth] signOut error:', e);
    }
  };

  const canEdit = !!user?.email && AUTHORIZED_EMAILS.includes(user.email.toLowerCase());
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  return {
    user,
    session,
    isLoading,
    signOut,
    canEdit,
    isAdmin,
    isAuthenticated: !!user,
  };
};
