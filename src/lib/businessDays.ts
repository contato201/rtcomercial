// Utilitários para cálculo de dias úteis (segunda a sexta) por mês.
// Não considera feriados nacionais.

export const businessDaysInMonth = (year: number, monthIndex: number): number => {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= last; day++) {
    const dow = new Date(year, monthIndex, day).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
};

export const isBusinessDay = (date: Date): boolean => {
  const dow = date.getDay();
  return dow !== 0 && dow !== 6;
};

export const businessDaysRemainingInMonth = (
  year: number,
  monthIndex: number,
  fromDate: Date = new Date(),
): number => {
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const today = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const start = today < monthStart ? monthStart : today;

  if (start > monthEnd) return 0;

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= monthEnd) {
    if (isBusinessDay(cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

export const DASHBOARD_YEAR = 2026;

export const businessDaysElapsedInMonth = (
  year: number,
  monthIndex: number,
  fromDate: Date = new Date(),
): number => {
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const today = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const limit = today > monthEnd ? monthEnd : today;

  if (limit < new Date(year, monthIndex, 1)) return 0;

  let count = 0;
  const cursor = new Date(year, monthIndex, 1);
  while (cursor <= limit) {
    if (isBusinessDay(cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

export const businessDaysBetween = (start: Date, end: Date): number => {
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const to = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (to < from) return 0;

  let count = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    if (isBusinessDay(cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};
