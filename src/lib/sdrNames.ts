export const SDR_COUNT = 3;
export const DEFAULT_SDRS: [string, string, string] = ['SDR 1', 'SDR 2', 'SDR 3'];
export const SDR_NAMES_KEY = 'sdr_names_v2';

export type SdrNames = [string, string, string];

export const loadSdrNames = (): SdrNames => {
  try {
    const stored = localStorage.getItem(SDR_NAMES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length === SDR_COUNT) {
        return [
          String(parsed[0] || DEFAULT_SDRS[0]),
          String(parsed[1] || DEFAULT_SDRS[1]),
          String(parsed[2] || DEFAULT_SDRS[2]),
        ];
      }
    }
  } catch {}
  return [...DEFAULT_SDRS];
};

export const saveSdrNames = (names: SdrNames) => {
  try {
    localStorage.setItem(SDR_NAMES_KEY, JSON.stringify(names));
  } catch {}
};
