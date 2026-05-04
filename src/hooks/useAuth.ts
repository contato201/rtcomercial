import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// E-mails autorizados para edição
const AUTHORIZED_EMAILS = [
  'contato@allancatao.com.br',
  'parceiros@reproduzindotalentos.com.br',
  'comercial@reproduzindotalentos.com.br',
];

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Verifica se o usuário logado tem permissão para editar
  const canEdit = user?.email === AUTHORIZED_EMAIL;

  return {
    user,
    session,
    isLoading,
    signOut,
    canEdit,
    isAuthenticated: !!user
  };
};
