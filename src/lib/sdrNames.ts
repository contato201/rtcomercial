import { supabase } from '@/integrations/supabase/client';

export const SDR_COUNT = 3;
export const DEFAULT_SDRS: [string, string, string] = ['SDR 1', 'SDR 2', 'SDR 3'];
export const SDR_NAMES_KEY = 'sdr_names_v2';
export const SDR_NAMES_EVENT = 'sdr-names-updated';

export type SdrNames = [string, string, string];

const normalize = (arr: any): SdrNames => {
  if (Array.isArray(arr) && arr.length === SDR_COUNT) {
    return [
      String(arr[0] || DEFAULT_SDRS[0]),
      String(arr[1] || DEFAULT_SDRS[1]),
      String(arr[2] || DEFAULT_SDRS[2]),
    ];
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
  try {
    localStorage.setItem(SDR_NAMES_KEY, JSON.stringify(names));
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
