import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}));

import { ensureFreshSession, isAuthError } from './sessionGuard';
import { supabase } from '@/integrations/supabase/client';

const mockedAuth = supabase.auth as unknown as {
  getSession: ReturnType<typeof vi.fn>;
  refreshSession: ReturnType<typeof vi.fn>;
};

const nowSec = () => Math.floor(Date.now() / 1000);

describe('ensureFreshSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna false quando não há sessão', async () => {
    mockedAuth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(ensureFreshSession()).resolves.toBe(false);
    expect(mockedAuth.refreshSession).not.toHaveBeenCalled();
  });

  it('retorna true quando o token ainda é válido (>60s)', async () => {
    mockedAuth.getSession.mockResolvedValue({
      data: { session: { expires_at: nowSec() + 600 } },
    });
    await expect(ensureFreshSession()).resolves.toBe(true);
    expect(mockedAuth.refreshSession).not.toHaveBeenCalled();
  });

  it('faz refresh quando o token está prestes a expirar (<60s)', async () => {
    mockedAuth.getSession.mockResolvedValue({
      data: { session: { expires_at: nowSec() + 30 } },
    });
    mockedAuth.refreshSession.mockResolvedValue({
      data: { session: { expires_at: nowSec() + 3600 } },
      error: null,
    });
    await expect(ensureFreshSession()).resolves.toBe(true);
    expect(mockedAuth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('faz refresh quando o token já expirou', async () => {
    mockedAuth.getSession.mockResolvedValue({
      data: { session: { expires_at: nowSec() - 100 } },
    });
    mockedAuth.refreshSession.mockResolvedValue({
      data: { session: { expires_at: nowSec() + 3600 } },
      error: null,
    });
    await expect(ensureFreshSession()).resolves.toBe(true);
    expect(mockedAuth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('retorna false quando o refresh token falha', async () => {
    mockedAuth.getSession.mockResolvedValue({
      data: { session: { expires_at: nowSec() - 10 } },
    });
    mockedAuth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid refresh token' },
    });
    await expect(ensureFreshSession()).resolves.toBe(false);
  });

  it('retorna false quando o refresh resolve sem sessão', async () => {
    mockedAuth.getSession.mockResolvedValue({
      data: { session: { expires_at: nowSec() + 10 } },
    });
    mockedAuth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    await expect(ensureFreshSession()).resolves.toBe(false);
  });

  it('retorna false quando getSession lança exceção', async () => {
    mockedAuth.getSession.mockRejectedValue(new Error('network down'));
    await expect(ensureFreshSession()).resolves.toBe(false);
  });
});

describe('isAuthError', () => {
  it('detecta erros de JWT pela mensagem', () => {
    expect(isAuthError({ message: 'JWT expired' })).toBe(true);
    expect(isAuthError({ message: 'invalid jwt token' })).toBe(true);
  });

  it('detecta erros de sessão e refresh token', () => {
    expect(isAuthError({ message: 'session not found' })).toBe(true);
    expect(isAuthError({ message: 'Invalid Refresh Token' })).toBe(true);
    expect(isAuthError({ message: 'User not authenticated' })).toBe(true);
  });

  it('detecta pelo código PGRST301 e 401', () => {
    expect(isAuthError({ code: 'PGRST301' })).toBe(true);
    expect(isAuthError({ code: '401' })).toBe(true);
  });

  it('retorna false para erros não relacionados a auth', () => {
    expect(isAuthError({ message: 'duplicate key value' })).toBe(false);
    expect(isAuthError({ code: 'PGRST116' })).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
    expect(isAuthError({})).toBe(false);
  });
});
