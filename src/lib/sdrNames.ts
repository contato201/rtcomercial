import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_SDRS: string[] = ['SDR 1', 'SDR 2', 'SDR 3'];
export const SDR_NAMES_KEY = 'sdr_names_v2';
export const SDR_NAMES_EVENT = 'sdr-names-updated';

// Backwards compat: many components import SdrNames. Now it's a dynamic list.
export type SdrNames = string[];

// Deprecated but kept for compat where imports still exist.
export const SDR_COUNT = 3;

const normalize = (arr: any): SdrNames => {
  if (Array.isArray(arr) && arr.length > 0) {
    return arr
      .map((v) => String(v ?? '').trim())
      .filter((v) => v.length > 0);
  }
  return [...DEFAULT_SDRS];
};

export const loadSdrNames = (): SdrNames => {
  try {
    const stored = localStorage.getItem(SDR_NAMES_KEY);
    if (stored) return normalize(JSON.parse(stored));
  } catch {}
  return [...DEFAULT_SDRS];
};

export const saveSdrNames = (names: SdrNames) => {
  const clean = normalize(names);
  try {
    localStorage.setItem(SDR_NAMES_KEY, JSON.stringify(clean));
  } catch {}
  window.dispatchEvent(new Event(SDR_NAMES_EVENT));
};

export const fetchSdrNamesFromDb = async (): Promise<SdrNames> => {
  try {
    const { data, error } = await (supabase as any)
      .from('app_settings')
      .select('value')
      .eq('key', 'sdr_names')
      .maybeSingle();
    if (error) throw error;
    const names = normalize(data?.value);
    saveSdrNames(names);
    return names;
  } catch (e) {
    console.warn('[sdrNames] fetch failed, using local:', e);
    return loadSdrNames();
  }
};

export const persistSdrNamesToDb = async (names: SdrNames): Promise<void> => {
  const clean = normalize(names);
  const { error } = await (supabase as any)
    .from('app_settings')
    .upsert({ key: 'sdr_names', value: clean as any }, { onConflict: 'key' });
  if (error) throw error;
  saveSdrNames(clean);
};

export const subscribeSdrNames = (cb: (names: SdrNames) => void) => {
  const channel = (supabase as any)
    .channel('app_settings_sdr_names')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.sdr_names' },
      (payload: any) => {
        const next = normalize(payload?.new?.value);
        saveSdrNames(next);
        cb(next);
      }
    )
    .subscribe();
  return () => {
    try { (supabase as any).removeChannel(channel); } catch {}
  };
};
