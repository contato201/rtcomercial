import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MetaMensal {
  monthIndex: number;
  metaVendas: number;
  metaPrimeiraReuniao: number;
  metaSegundaReuniao: number;
}

export interface PlanejamentoState {
  metas: MetaMensal[];
  ticketMedio: number;
  taxaComparecimento: number;
  loaded: boolean;
}

// Defaults (usados como fallback caso o banco não retorne nada)
const DEFAULT_METAS: MetaMensal[] = [
  { monthIndex: 0, metaVendas: 10, metaPrimeiraReuniao: 86, metaSegundaReuniao: 29 },
  { monthIndex: 1, metaVendas: 12, metaPrimeiraReuniao: 103, metaSegundaReuniao: 35 },
  { monthIndex: 2, metaVendas: 14, metaPrimeiraReuniao: 121, metaSegundaReuniao: 41 },
  { monthIndex: 3, metaVendas: 10, metaPrimeiraReuniao: 86, metaSegundaReuniao: 29 },
  { monthIndex: 4, metaVendas: 18, metaPrimeiraReuniao: 153, metaSegundaReuniao: 52 },
  { monthIndex: 5, metaVendas: 14, metaPrimeiraReuniao: 121, metaSegundaReuniao: 41 },
  { monthIndex: 6, metaVendas: 24, metaPrimeiraReuniao: 203, metaSegundaReuniao: 69 },
  { monthIndex: 7, metaVendas: 25, metaPrimeiraReuniao: 212, metaSegundaReuniao: 72 },
  { monthIndex: 8, metaVendas: 22, metaPrimeiraReuniao: 189, metaSegundaReuniao: 64 },
  { monthIndex: 9, metaVendas: 24, metaPrimeiraReuniao: 203, metaSegundaReuniao: 69 },
  { monthIndex: 10, metaVendas: 30, metaPrimeiraReuniao: 256, metaSegundaReuniao: 87 },
  { monthIndex: 11, metaVendas: 26, metaPrimeiraReuniao: 221, metaSegundaReuniao: 75 },
];

const DEFAULT_TICKET = 2700;
const DEFAULT_TAXA = 0.6;

const state: PlanejamentoState = {
  metas: [...DEFAULT_METAS],
  ticketMedio: DEFAULT_TICKET,
  taxaComparecimento: DEFAULT_TAXA,
  loaded: false,
};

const EVENT = 'planejamento-updated';

const emit = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT));
  }
};

export const getMetaMes = (monthIndex: number): MetaMensal => {
  return state.metas.find((m) => m.monthIndex === monthIndex) ?? DEFAULT_METAS[monthIndex];
};

export const getTicketMedio = (): number => state.ticketMedio;
export const getTaxaComparecimento = (): number => state.taxaComparecimento;
export const getAllMetas = (): MetaMensal[] => [...state.metas];

export const loadPlanejamento = async (): Promise<void> => {
  try {
    const [metasRes, settingsRes] = await Promise.all([
      (supabase as any).from('planejamento_mensal').select('*').order('month_index'),
      (supabase as any)
        .from('app_settings')
        .select('key,value')
        .in('key', ['ticket_medio', 'taxa_comparecimento']),
    ]);

    if (!metasRes.error && Array.isArray(metasRes.data) && metasRes.data.length > 0) {
      const map = new Map<number, MetaMensal>();
      for (const row of metasRes.data as any[]) {
        map.set(row.month_index, {
          monthIndex: row.month_index,
          metaVendas: Number(row.meta_vendas) || 0,
          metaPrimeiraReuniao: Number(row.meta_primeira_reuniao) || 0,
          metaSegundaReuniao: Number(row.meta_segunda_reuniao) || 0,
        });
      }
      state.metas = DEFAULT_METAS.map((d) => map.get(d.monthIndex) ?? d);
    }

    if (!settingsRes.error && Array.isArray(settingsRes.data)) {
      for (const row of settingsRes.data as any[]) {
        const raw = row.value;
        const num = typeof raw === 'number' ? raw : Number(raw);
        if (row.key === 'ticket_medio' && Number.isFinite(num) && num > 0) {
          state.ticketMedio = num;
        }
        if (row.key === 'taxa_comparecimento' && Number.isFinite(num) && num > 0) {
          state.taxaComparecimento = num;
        }
      }
    }

    state.loaded = true;
    emit();
  } catch (e) {
    console.warn('[planejamento] load failed:', e);
  }
};

export const subscribePlanejamento = (cb: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, cb);
  const channel = (supabase as any)
    .channel('planejamento_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'planejamento_mensal' },
      () => {
        loadPlanejamento();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_settings',
        filter: 'key=in.(ticket_medio,taxa_comparecimento)',
      },
      () => {
        loadPlanejamento();
      }
    )
    .subscribe();
  return () => {
    window.removeEventListener(EVENT, cb);
    try { (supabase as any).removeChannel(channel); } catch {}
  };
};

export const usePlanejamento = (): PlanejamentoState => {
  const [snapshot, setSnapshot] = useState<PlanejamentoState>({ ...state });

  useEffect(() => {
    let mounted = true;
    const sync = () => {
      if (mounted) setSnapshot({ ...state });
    };
    loadPlanejamento().then(sync);
    const unsub = subscribePlanejamento(sync);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return snapshot;
};

// Mutators (admin)
export const saveMetaMes = async (
  monthIndex: number,
  metaVendas: number,
  metaPrimeiraReuniao: number,
  metaSegundaReuniao: number
): Promise<void> => {
  const { error } = await (supabase as any)
    .from('planejamento_mensal')
    .upsert(
      {
        month_index: monthIndex,
        meta_vendas: Math.max(0, Math.round(metaVendas)),
        meta_primeira_reuniao: Math.max(0, Math.round(metaPrimeiraReuniao)),
        meta_segunda_reuniao: Math.max(0, Math.round(metaSegundaReuniao)),
      },
      { onConflict: 'month_index' }
    );
  if (error) throw error;
  await loadPlanejamento();
};

export const saveTicketMedio = async (value: number): Promise<void> => {
  const num = Math.max(1, Math.round(value));
  const { error } = await (supabase as any)
    .from('app_settings')
    .upsert({ key: 'ticket_medio', value: num as any }, { onConflict: 'key' });
  if (error) throw error;
  await loadPlanejamento();
};

export const saveTaxaComparecimento = async (value: number): Promise<void> => {
  const num = Math.max(0.05, Math.min(1, value));
  const { error } = await (supabase as any)
    .from('app_settings')
    .upsert({ key: 'taxa_comparecimento', value: num as any }, { onConflict: 'key' });
  if (error) throw error;
  await loadPlanejamento();
};
