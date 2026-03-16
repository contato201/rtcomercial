/**
 * Utilitários de formatação centralizados
 * Garante consistência de exibição em toda a aplicação
 */

export const toFiniteNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const clampPercentage = (value: number, max: number = 100): number => {
  const safeValue = toFiniteNumber(value);
  return Math.min(Math.max(safeValue, 0), max);
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(toFiniteNumber(value));
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('pt-BR').format(toFiniteNumber(value));
};

export const formatPercent = (value: number, decimals: number = 1): string => {
  return `${toFiniteNumber(value).toFixed(decimals)}%`;
};

export const formatDateTime = (date: Date | null): string => {
  if (!date) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const safePercentage = (realizado: number, meta: number): number => {
  const safeMeta = toFiniteNumber(meta);
  const safeRealizado = toFiniteNumber(realizado);

  if (safeMeta <= 0) return 0;

  const result = (safeRealizado / safeMeta) * 100;
  return Number.isFinite(result) ? Math.max(result, 0) : 0;
};

export const safeVariation = (meta: number, realizado: number): number => {
  const safeMeta = toFiniteNumber(meta);
  const safeRealizado = toFiniteNumber(realizado);

  if (safeMeta <= 0) return safeRealizado > 0 ? 100 : 0;

  const result = ((safeRealizado - safeMeta) / safeMeta) * 100;
  return Number.isFinite(result) ? result : 0;
};
