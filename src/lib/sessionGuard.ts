import { supabase } from '@/integrations/supabase/client';

/**
 * Garante que o token JWT esteja válido antes de fazer requests ao banco.
 * Se estiver perto de expirar (≤ 60s) ou já expirado, tenta renovar via refresh token.
 * Retorna true se há sessão válida após a checagem.
 */
export async function ensureFreshSession(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const expiresAt = session.expires_at ?? 0;
    const nowSec = Math.floor(Date.now() / 1000);
    const secondsLeft = expiresAt - nowSec;

    // Se faltam menos de 60s ou já expirou, força refresh
    if (secondsLeft < 60) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        console.warn('[sessionGuard] refresh failed:', error?.message);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.warn('[sessionGuard] error:', e);
    return false;
  }
}

/** Detecta se o erro é por token/sessão expirada */
export function isAuthError(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message ?? '').toLowerCase();
  const code = String((error as { code?: string } | null)?.code ?? '').toLowerCase();
  return (
    message.includes('jwt') ||
    message.includes('session') ||
    message.includes('refresh token') ||
    message.includes('not authenticated') ||
    code === 'pgrst301' ||
    code === '401'
  );
}
