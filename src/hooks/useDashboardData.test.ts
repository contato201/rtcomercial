import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ----- Mocks -----

const sessionGuardMock = vi.hoisted(() => ({
  ensureFreshSession: vi.fn(),
  isAuthError: vi.fn(),
}));

vi.mock('@/lib/sessionGuard', () => sessionGuardMock);

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock supabase client with chainable from() and a channel stub
const fromMock = vi.hoisted(() => vi.fn());
const channelMock = vi.hoisted(() => ({
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    channel: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  },
}));

import { useDashboardData } from './useDashboardData';

// Helper: build a chainable query that resolves to {data, error}
function makeQuery(result: { data: unknown; error: unknown }) {
  const thenable: any = {
    select: vi.fn(() => thenable),
    order: vi.fn(() => thenable),
    eq: vi.fn(() => thenable),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: any, reject: any) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return thenable;
}

const okResult = { data: [], error: null };
const authErrorResult = { data: null, error: { message: 'JWT expired', code: 'PGRST301' } };

describe('useDashboardData - integration: token expiration & retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionGuardMock.ensureFreshSession.mockResolvedValue(true);
    sessionGuardMock.isAuthError.mockImplementation((e: any) =>
      Boolean(e && (String(e.message ?? '').toLowerCase().includes('jwt') || e.code === 'PGRST301'))
    );
  });

  it('chama ensureFreshSession antes do load inicial', async () => {
    fromMock.mockImplementation(() => makeQuery(okResult));

    renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(sessionGuardMock.ensureFreshSession).toHaveBeenCalled();
    });
    // 4 queries iniciais
    expect(fromMock).toHaveBeenCalledWith('dados_realizados');
    expect(fromMock).toHaveBeenCalledWith('vendas_unitarias');
  });

  it('faz retry das queries quando alguma retorna isAuthError', async () => {
    let call = 0;
    // Primeira rodada (4 queries) -> auth error em uma delas
    // Segunda rodada (4 queries) -> ok
    fromMock.mockImplementation(() => {
      call++;
      // Calls 1..4 = primeira rodada; uma delas (a 2ª) retorna auth error
      if (call <= 4) {
        return makeQuery(call === 2 ? authErrorResult : okResult);
      }
      return makeQuery(okResult);
    });

    renderHook(() => useDashboardData());

    await waitFor(() => {
      // ensureFreshSession deve ter sido chamado pelo menos 2x (inicial + retry)
      expect(sessionGuardMock.ensureFreshSession.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    // Deve ter feito mais de 4 chamadas a from() devido ao retry
    await waitFor(() => {
      expect(fromMock.mock.calls.length).toBeGreaterThanOrEqual(8);
    });
  });

  it('não faz retry se ensureFreshSession falhar no segundo ciclo', async () => {
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      return makeQuery(authErrorResult);
    });

    // Primeiro retorna true (load inicial), segundo retorna false (refresh falhou)
    sessionGuardMock.ensureFreshSession
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(sessionGuardMock.ensureFreshSession).toHaveBeenCalledTimes(2);
    });

    // Apenas 4 chamadas (sem rodada extra)
    expect(fromMock.mock.calls.length).toBe(4);
  });

  it('recarrega dados ao detectar token previamente expirado e refresh bem-sucedido', async () => {
    // Simula: 1ª rodada toda com auth error (token expirado),
    // refresh OK, 2ª rodada com dados válidos
    let round = 0;
    fromMock.mockImplementation(() => {
      // Em cada bloco de 4 chamadas alterna
      const isFirstRound = fromMock.mock.calls.length <= 4;
      return makeQuery(isFirstRound ? authErrorResult : okResult);
    });

    renderHook(() => useDashboardData());

    await waitFor(() => {
      expect(fromMock.mock.calls.length).toBeGreaterThanOrEqual(8);
    });

    // ensureFreshSession chamado novamente após detectar auth error
    expect(sessionGuardMock.ensureFreshSession).toHaveBeenCalledTimes(2);
    // E isAuthError foi consultado
    expect(sessionGuardMock.isAuthError).toHaveBeenCalled();
  });
});
